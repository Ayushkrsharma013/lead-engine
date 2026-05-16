import { NextRequest, NextResponse } from "next/server";
import { jobActivateProfile } from "@/lib/finance-agent";
import { tgAnswerCallback, tgEdit } from "@/lib/telegram-bot";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";

const supabase = supabaseAdmin;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const callbackQuery = body.callback_query as Record<string, unknown> | undefined;
  if (!callbackQuery) return NextResponse.json({ ok: true });

  const callbackId = String(callbackQuery.id || "");
  const data = String(callbackQuery.data || "");
  const message = callbackQuery.message as Record<string, unknown> | undefined;
  const messageId = (message?.message_id as number) || 0;

  await tgAnswerCallback(callbackId);

  const [action, profileId] = data.split(":");

  switch (action) {
    case "activate": {
      const result = await jobActivateProfile(profileId);
      if (messageId && result.success) {
        await tgEdit(
          messageId,
          `✅ <b>Activated</b>\n\n👤 ${result.email}\n\n<i>Confirmation email sent to client.</i>`,
        );
      } else if (messageId) {
        await tgEdit(messageId, `❌ <b>Activation failed</b>\n\n${result.error}`);
      }
      break;
    }

    case "invoice_sent": {
      await supabase
        .from("finance_agent_log")
        .update({ status: "actioned", updated_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .eq("event_type", "payment_request")
        .eq("status", "pending");

      if (messageId) {
        await tgEdit(messageId, `📬 <b>Invoice Sent</b>\n\n<i>Marked as invoice sent. Reminder in 48hrs if no payment.</i>`);
      }
      break;
    }

    case "snooze": {
      if (messageId) {
        await tgEdit(messageId, `⏰ <b>Snoozed</b>\n\n<i>Re-alert scheduled.</i>`);
      }
      break;
    }

    case "dismiss": {
      await supabase
        .from("finance_agent_log")
        .update({ status: "dismissed", updated_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .eq("status", "pending");

      if (messageId) {
        await tgEdit(messageId, `🗑️ <b>Dismissed</b>`);
      }
      break;
    }

    case "send_followup": {
      const { data: log } = await supabase
        .from("finance_agent_log")
        .select("payload")
        .eq("profile_id", profileId)
        .eq("event_type", "followup_sent")
        .eq("status", "pending")
        .single();

      if (log) {
        const pl = log.payload as { email: string; subject: string; html: string };
        await sendEmail({ to: pl.email, subject: pl.subject, html: pl.html });

        await supabase
          .from("finance_agent_log")
          .update({ status: "actioned", updated_at: new Date().toISOString() })
          .eq("profile_id", profileId)
          .eq("event_type", "followup_sent");

        if (messageId) {
          await tgEdit(messageId, `📤 <b>Follow-up sent</b> to ${pl.email}`);
        }
      }
      break;
    }

    case "dismiss_followup": {
      await supabase
        .from("finance_agent_log")
        .update({ status: "dismissed", updated_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .eq("event_type", "followup_sent");

      if (messageId) {
        await tgEdit(messageId, `⏭️ <b>Follow-up skipped</b>`);
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
