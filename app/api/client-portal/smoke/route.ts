import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Phase 3.3 — Client Portal smoke endpoint.
 *
 * GET /api/client-portal/smoke
 *
 * super_admin / qa_agent only. Returns counts that prove the post-payment
 * provisioning loop is healthy:
 *   - totalClients          — profiles with role='client'
 *   - activeMicro           — micro-plan profiles currently active
 *   - activeClients30d      — clients activated in the last 30 days
 *   - recentSignups         — last 5 client profiles by created_at
 *   - lastWebhookFired      — most recent xflow_transaction_id timestamp
 *   - errors                — list of soft errors collected during the run
 */
export async function GET(req: NextRequest) {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
    /\/rest\/v1\/?$/,
    ""
  );

  const supabaseSSR = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  );

  const {
    data: { user },
  } = await supabaseSSR.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: caller } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (caller?.role as string | undefined) ?? null;
  if (role !== "super_admin" && role !== "qa_agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const errors: string[] = [];

  // 1) totalClients — profiles with role='client'
  const { count: totalClients, error: totalErr } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "client");
  if (totalErr) errors.push(`totalClients: ${totalErr.message}`);

  // 2) activeMicro — micro plan, currently active
  const { count: activeMicro, error: microErr } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("plan", "micro")
    .eq("subscription_status", "active");
  if (microErr) errors.push(`activeMicro: ${microErr.message}`);

  // 3) activeClients30d — clients activated in the last 30 days
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { count: activeClients30d, error: recentErr } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "client")
    .eq("subscription_status", "active")
    .gte("subscription_activated_at", thirtyDaysAgo);
  if (recentErr) errors.push(`activeClients30d: ${recentErr.message}`);

  // 4) recentSignups — last 5 client profiles
  const { data: recent, error: signupErr } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, full_name, plan, subscription_status, subscription_activated_at, created_at"
    )
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .limit(5);
  if (signupErr) errors.push(`recentSignups: ${signupErr.message}`);

  // 5) lastWebhookFired — newest xflow_transaction_id timestamp
  const { data: lastTxn, error: webhookErr } = await supabaseAdmin
    .from("profiles")
    .select("xflow_transaction_id, subscription_activated_at, email")
    .not("xflow_transaction_id", "is", null)
    .order("subscription_activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (webhookErr) errors.push(`lastWebhookFired: ${webhookErr.message}`);

  // 6) pending_transactions backlog (rows that have not been reconciled)
  const { count: pendingTxns, error: pendingErr } = await supabaseAdmin
    .from("pending_transactions")
    .select("*", { count: "exact", head: true });
  // pending_transactions may not exist in dev — soft error only
  if (pendingErr && !/relation .* does not exist/i.test(pendingErr.message)) {
    errors.push(`pendingTxns: ${pendingErr.message}`);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    totalClients: totalClients ?? 0,
    activeMicro: activeMicro ?? 0,
    activeClients30d: activeClients30d ?? 0,
    recentSignups: recent ?? [],
    lastWebhookFired: lastTxn
      ? {
          txnid: lastTxn.xflow_transaction_id,
          activatedAt: lastTxn.subscription_activated_at,
          email: lastTxn.email,
        }
      : null,
    pendingTransactions: pendingTxns ?? 0,
    errors,
    checkedAt: new Date().toISOString(),
  });
}
