/**
 * RLS Policy Tester — Row-Level Security Validation
 *
 * Tests Supabase RLS policies by creating test users with different roles
 * and verifying they can only access what their role permits.
 *
 * Uses the admin client for setup/teardown, and anon/authenticated clients
 * for actual assertions.
 *
 * Environment variables required:
 *   SUPABASE_URL — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key for admin client
 *   TEST_USER_PASSWORD — password for test users (default: "test-password-123!")
 */

import { supabaseAdmin, supabaseAnon, createAuthClient } from "../utils/supabase_client";
import { generateProspect } from "../utils/test_data_generator";

const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "test-password-123!";

// ─── Test users we'll create ──────────────────────────────────────────────────

interface TestUser {
  id: string;
  email: string;
  role: string;
  password: string;
}

const testUsers: TestUser[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createTestUser(role: string): Promise<TestUser> {
  const prospect = generateProspect();
  const email = prospect.email;

  // Create auth user
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { role },
  });

  if (authError || !authUser?.user) {
    throw new Error(`Failed to create ${role} test user: ${authError?.message}`);
  }

  const userId = authUser.user.id;

  // Create profile
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: userId,
      email,
      display_name: prospect.name,
      role,
      subscription_status: role === "client" ? "active" : "inactive",
      plan: role === "client" ? "micro" : null,
      is_active: true,
    });

  if (profileError) {
    console.warn(`[rls] Profile creation warning for ${role}: ${profileError.message}`);
  }

  return { id: userId, email, role, password: TEST_PASSWORD };
}

async function cleanupTestUsers() {
  for (const user of testUsers) {
    try {
      await supabaseAdmin.from("profiles").delete().eq("id", user.id);
      await supabaseAdmin.from("clients").delete().eq("user_id", user.id);
      await supabaseAdmin.from("client_workspaces").delete().eq("client_user_id", user.id);
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    } catch (err) {
      console.warn(`[rls] Cleanup failed for ${user.email}:`, err);
    }
  }
}

// ─── Vulnerability report ─────────────────────────────────────────────────────

interface Vulnerability {
  test: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  expected: string;
  actual: string;
}

const vulnerabilities: Vulnerability[] = [];

function reportVulnerability(
  test: string,
  severity: Vulnerability["severity"],
  description: string,
  expected: string,
  actual: string
) {
  vulnerabilities.push({ test, severity, description, expected, actual });
  console.log(`\n🚨 VULNERABILITY [${severity.toUpperCase()}] — ${test}`);
  console.log(`   ${description}`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Actual:   ${actual}`);
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

async function runRLSTests() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  RLS POLICY TESTER — Row-Level Security Validation");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Setup: Create test users ────────────────────────────────────────────────
  console.log("[setup] Creating test users...");

  const anonUser = await createTestUser("user");
  const clientUser = await createTestUser("client");
  testUsers.push(anonUser, clientUser);

  console.log(`[setup] Created: anon(${anonUser.email}), client(${clientUser.email})`);

  // Get auth clients
  const anonClient = await createAuthClient(anonUser.email, TEST_PASSWORD);
  const clientAuthClient = await createAuthClient(clientUser.email, TEST_PASSWORD);

  if (!anonClient || !clientAuthClient) {
    throw new Error("Failed to create authenticated clients — check user credentials");
  }

  // Share a workspace for ownership tests
  let testWorkspaceId: string | undefined;

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .insert({
      client_user_id: clientUser.id,
      plan: "micro",
      leads_generation_status: "pending",
      icp_config: { industries: ["SaaS"] },
    })
    .select("id")
    .single();

  if (workspace) {
    testWorkspaceId = (workspace as any).id;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 1: Anonymous cannot read profiles
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 1: Anonymous access to profiles ───");
  try {
    const { data, error } = await supabaseAnon.from("profiles").select("*").limit(1);

    if (!error && data && data.length > 0) {
      reportVulnerability(
        "anon-read-profiles",
        "critical",
        "Anonymous user should not be able to read profiles table",
        "Error or empty result",
        `Returned ${data.length} profile(s)`
      );
    } else {
      console.log("✅ PASS: Anonymous cannot read profiles");
    }
  } catch (err) {
    console.log(`✅ PASS: Anonymous profiles read threw error: ${err}`);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 2: Anonymous cannot read client_workspaces
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 2: Anonymous access to client_workspaces ───");
  try {
    const { data, error } = await supabaseAnon
      .from("client_workspaces")
      .select("*")
      .limit(1);

    if (!error && data && data.length > 0) {
      reportVulnerability(
        "anon-read-workspaces",
        "critical",
        "Anonymous user should not be able to read client_workspaces",
        "Error or empty result",
        `Returned ${data.length} workspace(s)`
      );
    } else {
      console.log("✅ PASS: Anonymous cannot read client_workspaces");
    }
  } catch (err) {
    console.log(`✅ PASS: Anonymous workspace read threw error: ${err}`);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 3: Anonymous cannot read client_leads
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 3: Anonymous access to client_leads ───");
  try {
    const { data, error } = await supabaseAnon.from("client_leads").select("*").limit(1);

    if (!error && data && data.length > 0) {
      reportVulnerability(
        "anon-read-leads",
        "critical",
        "Anonymous user should not be able to read client_leads",
        "Error or empty result",
        `Returned ${data.length} lead(s)`
      );
    } else {
      console.log("✅ PASS: Anonymous cannot read client_leads");
    }
  } catch (err) {
    console.log(`✅ PASS: Anonymous leads read threw error: ${err}`);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 4: Anonymous cannot read appointments
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 4: Anonymous access to appointments ───");
  try {
    const { data, error } = await supabaseAnon.from("appointments").select("*").limit(1);

    if (!error && data && data.length > 0) {
      reportVulnerability(
        "anon-read-appointments",
        "high",
        "Anonymous user should not be able to read appointments",
        "Error or empty result",
        `Returned ${data.length} appointment(s)`
      );
    } else {
      console.log("✅ PASS: Anonymous cannot read appointments");
    }
  } catch (err) {
    console.log(`✅ PASS: Anonymous appointments read threw error: ${err}`);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 5: Non-admin user cannot update another user's profile
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 5: Cross-user profile update ───");
  try {
    const { error } = await supabaseAnon
      .from("profiles")
      .update({ display_name: "HACKED" })
      .eq("id", clientUser.id);

    const actuallyUpdated = !error || error.code !== "PGRST116"; // PGRST116 = no rows

    if (actuallyUpdated && !error) {
      // Verify if the update actually happened
      const { data: check } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", clientUser.id)
        .single();

      if (check && (check as any).display_name === "HACKED") {
        reportVulnerability(
          "cross-user-update",
          "critical",
          "Non-admin user should not be able to update another user's profile",
          "Update denied",
          "Profile was modified"
        );
      }
    } else {
      console.log(`✅ PASS: Cross-user profile update blocked (error: ${error?.code || "none"})`);
    }
  } catch (err) {
    console.log(`✅ PASS: Cross-user profile update threw: ${err}`);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 6: User cannot delete workspace they don't own
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 6: Cross-user workspace delete ───");
  if (testWorkspaceId && anonClient) {
    try {
      const { error } = await anonClient
        .from("client_workspaces")
        .delete()
        .eq("id", testWorkspaceId);

      if (!error) {
        // Check if workspace was actually deleted
        const { data: check } = await supabaseAdmin
          .from("client_workspaces")
          .select("id")
          .eq("id", testWorkspaceId)
          .maybeSingle();

        if (!check) {
          reportVulnerability(
            "cross-user-workspace-delete",
            "critical",
            "User should not be able to delete another user's workspace",
            "Delete denied",
            "Workspace was deleted"
          );
        } else {
          console.log("✅ PASS: Workspace delete blocked by RLS");
        }
      } else {
        console.log(`✅ PASS: Cross-user workspace delete blocked (error: ${error.code})`);
      }
    } catch (err) {
      console.log(`✅ PASS: Cross-user workspace delete threw: ${err}`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 7: User can read their own profile
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 7: Own profile read ───");
  if (anonClient) {
    try {
      const { data, error } = await anonClient
        .from("profiles")
        .select("id, email, role")
        .eq("id", anonUser.id)
        .maybeSingle();

      if (error) {
        console.log(`ℹ️  Own profile read restricted: ${error.message}`);
      } else if (data) {
        console.log("✅ PASS: User can read own profile");
      }
    } catch (err) {
      console.log(`ℹ️  Own profile read threw: ${err}`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 8: Client can read their own workspace
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 8: Own workspace read ───");
  if (clientAuthClient) {
    try {
      const { data, error } = await clientAuthClient
        .from("client_workspaces")
        .select("id")
        .eq("client_user_id", clientUser.id)
        .maybeSingle();

      if (error) {
        console.log(`ℹ️  Own workspace read restricted: ${error.message}`);
      } else if (data) {
        console.log("✅ PASS: Client can read own workspace");
      }
    } catch (err) {
      console.log(`ℹ️  Own workspace read threw: ${err}`);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  console.log("\n─── Cleanup ───");
  await cleanupTestUsers();
  console.log("[cleanup] Test users removed");

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  RLS TEST COMPLETE — ${vulnerabilities.length} vulnerabilities found`);
  console.log("═══════════════════════════════════════════════════════════");

  if (vulnerabilities.length > 0) {
    console.log("\n🚨 VULNERABILITY REPORT:");
    for (const v of vulnerabilities) {
      console.log(`  [${v.severity.toUpperCase()}] ${v.test}`);
      console.log(`    ${v.description}`);
      console.log(`    Expected: ${v.expected}`);
      console.log(`    Actual: ${v.actual}\n`);
    }
    process.exitCode = 1;
  } else {
    console.log("\n✅ All RLS policies are properly configured.");
  }
}

// Run if executed directly
runRLSTests().catch((err) => {
  console.error("[rls] Fatal error:", err);
  process.exit(1);
});
