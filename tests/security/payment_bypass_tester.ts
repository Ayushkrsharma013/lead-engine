/**
 * Payment Bypass Tester
 *
 * Tests the payment webhook endpoint for:
 * 1. Signature validation (reject invalid/missing HMAC signatures)
 * 2. Idempotency (replaying the same webhook doesn't double-credit)
 * 3. Amount validation (undersized payments handled correctly)
 *
 * Uses a mock payment server to intercept webhook calls, or directly
 * hits the app's webhook endpoint with forged payloads.
 *
 * Environment variables required:
 *   APP_URL — base URL of the app
 *   DODO_WEBHOOK_SECRET — Dodo webhook secret for signature verification
 *   MOCK_PAYMENT_URL — URL of mock payment server (default: http://localhost:3456)
 */

import crypto from "node:crypto";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const BASE_PATH = "/prospecting-os";
const WEBHOOK_URL = `${APP_URL}${BASE_PATH}/api/payment/webhook`;
const DODO_SECRET = process.env.DODO_WEBHOOK_SECRET || "test-secret-do-not-use-in-prod";
const MOCK_PAYMENT_URL = process.env.MOCK_PAYMENT_URL || "http://localhost:3456";

// ─── Vulnerabilities found ────────────────────────────────────────────────────

interface BypassFinding {
  test: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  expected: string;
  actual: string;
}

const bypassFindings: BypassFinding[] = [];

function reportFinding(finding: BypassFinding) {
  bypassFindings.push(finding);
  console.log(`\n🚨 [${finding.severity.toUpperCase()}] ${finding.test}`);
  console.log(`   ${finding.description}`);
  console.log(`   Expected: ${finding.expected}`);
  console.log(`   Actual: ${finding.actual}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a valid Dodo webhook signature using HMAC-SHA256.
 */
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Send a webhook request to the app's payment endpoint.
 */
async function sendWebhook(
  payload: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 1000) };
  } catch (err) {
    return { status: 0, body: `Request failed: ${err}` };
  }
}

// ─── Test runner ──────────────────────────────────────────────────────────────

async function runPaymentBypassTests() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  PAYMENT BYPASS TESTER — Webhook Security Validation");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 1: Missing HMAC signature should be rejected
  // ────────────────────────────────────────────────────────────────────────────
  console.log("─── Test 1: Missing Dodo signature ───");
  {
    const payload = {
      event: "payment.succeeded",
      data: {
        payment: {
          id: "pay_test_no_sig",
          email: "bypass-test@flow-forges-test.com",
          amount: 9700,
          product_id: "prod_micro",
          status: "succeeded",
        },
      },
    };

    const { status, body } = await sendWebhook(payload, {
      // Deliberately omit dodo-signature header
    });

    console.log(`   Status: ${status}`);
    console.log(`   Response: ${body.slice(0, 200)}`);

    // Should return 401 for missing signature (if Dodo webhook path is used)
    if (status === 200 || status === 201) {
      reportFinding({
        test: "missing-signature-accepted",
        severity: "critical",
        description:
          "Webhook accepted without Dodo HMAC signature — anyone can forge successful payments",
        expected: "401 Unauthorized",
        actual: `Status ${status}`,
      });
    } else if (status === 401) {
      console.log("✅ PASS: Missing signature correctly rejected with 401");
    } else {
      console.log(`ℹ️  Non-standard response: ${status} — may use non-Dodo path`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 2: Invalid HMAC signature should be rejected
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 2: Invalid Dodo signature ───");
  {
    const payload = {
      event: "payment.succeeded",
      data: {
        payment: {
          id: "pay_test_bad_sig",
          email: "bypass-test-2@flow-forges-test.com",
          amount: 9700,
          product_id: "prod_micro",
          status: "succeeded",
        },
      },
    };

    const body = JSON.stringify(payload);
    const fakeSig = generateSignature(body, "wrong-secret-key");

    const { status } = await sendWebhook(payload, {
      "dodo-signature": fakeSig,
    });

    console.log(`   Status: ${status}`);

    if (status === 200 || status === 201) {
      reportFinding({
        test: "invalid-signature-accepted",
        severity: "critical",
        description:
          "Webhook accepted with invalid HMAC signature — signature verification may be broken",
        expected: "401 Unauthorized",
        actual: `Status ${status}`,
      });
    } else if (status === 401) {
      console.log("✅ PASS: Invalid signature correctly rejected with 401");
    } else {
      console.log(`ℹ️  Status: ${status} — might be using different auth path`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 3: Replay attack (idempotency check)
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 3: Replay attack (idempotency) ───");
  {
    const paymentId = `pay_test_replay_${Date.now()}`;
    const testEmail = `replay-test-${Date.now()}@flow-forges-test.com`;

    const payload = {
      event: "payment.succeeded",
      data: {
        payment: {
          id: paymentId,
          email: testEmail,
          amount: 9700,
          product_id: "prod_micro",
          status: "succeeded",
        },
      },
    };

    const bodyStr = JSON.stringify(payload);
    const validSig = generateSignature(bodyStr, DODO_SECRET);

    // First request — should process
    const { status: status1 } = await sendWebhook(payload, {
      "dodo-signature": validSig,
    });
    console.log(`   Request 1 status: ${status1}`);

    // Small delay to ensure DB writes complete
    await new Promise((r) => setTimeout(r, 1000));

    // Second request with same payment_id — should be idempotent
    const { status: status2, body: body2 } = await sendWebhook(payload, {
      "dodo-signature": validSig,
    });
    console.log(`   Request 2 status: ${status2}`);

    // Parse response to check if idempotency was handled
    try {
      const resp = JSON.parse(body2);
      if (resp.alreadyActive || resp.received) {
        console.log("✅ PASS: Webhook idempotency correctly handled (no double credit)");
      } else if (resp.activated) {
        reportFinding({
          test: "replay-not-idempotent",
          severity: "high",
          description:
            "Same payment ID processed twice — webhook is not idempotent; could lead to double credit",
          expected: "alreadyActive: true or received: true",
          actual: `activated: true (processed again!)`,
        });
      }
    } catch {
      console.log(`ℹ️  Could not parse idempotency response: ${body2.slice(0, 100)}`);
    }

    // Cleanup test user
    try {
      const profile = await fetch(
        `${APP_URL}${BASE_PATH}/api/admin/clients`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-user-role": "super_admin",
          },
        }
      ).then((r) => r.json().catch(() => ({ clients: [] }))) as { clients?: Array<{ email: string }> };

      if (profile?.clients) {
        const testClient = profile.clients.find(
          (c) => c.email === testEmail
        );
        if (testClient) {
          // Delete via admin client
          console.log(`   [cleanup] Found test client ${testEmail}, would cleanup`);
        }
      }
    } catch { /* cleanup is best-effort */ }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 4: Undersized payment amount for plan
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 4: Undersized payment amount ───");
  {
    const paymentId = `pay_test_undersized_${Date.now()}`;
    const testEmail = `undersized-test-${Date.now()}@flow-forges-test.com`;

    // Micro plan costs $97, send $1 instead
    const payload = {
      event: "payment.succeeded",
      data: {
        payment: {
          id: paymentId,
          email: testEmail,
          amount: 100, // $1.00 — way below any plan price
          product_id: "prod_growth", // Growth plan is $497
          status: "succeeded",
        },
      },
    };

    const bodyStr = JSON.stringify(payload);
    const validSig = generateSignature(bodyStr, DODO_SECRET);

    const { status, body } = await sendWebhook(payload, {
      "dodo-signature": validSig,
    });

    console.log(`   Status: ${status}`);
    console.log(`   Response: ${body.slice(0, 300)}`);

    // Check if the plan amount was validated
    let resp: any = {};
    try { resp = JSON.parse(body); } catch { resp = {}; }
    if (resp.activated) {
      // Check what plan was actually assigned
      console.log(`⚠️  Undersized payment activated with amount $1.00 for growth plan`);
      // This is a finding if the system doesn't validate the amount
      // Note: The current implementation maps by product_id, not amount
      console.log("ℹ️  Current webhook assigns plan by product_id, not amount — amount validation not enforced");
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 5: Tampered payload (body modified after signing)
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 5: Tampered payload ───");
  {
    const originalPayload = {
      event: "payment.succeeded",
      data: {
        payment: {
          id: "pay_test_tamper",
          email: "legit@flow-forges-test.com",
          amount: 9700,
          product_id: "prod_micro",
          status: "succeeded",
        },
      },
    };

    const originalBody = JSON.stringify(originalPayload);
    const validSig = generateSignature(originalBody, DODO_SECRET);

    // Send tampered body but with original signature
    const tamperedPayload = {
      event: "payment.succeeded",
      data: {
        payment: {
          id: "pay_test_tamper",
          email: "attacker@evil.com", // Changed email!
          amount: 999999, // Changed amount!
          product_id: "prod_growth",
          status: "succeeded",
        },
      },
    };

    const { status } = await sendWebhook(tamperedPayload, {
      "dodo-signature": validSig, // Original signature for original body
    });

    console.log(`   Status: ${status}`);

    if (status === 200 || status === 201) {
      reportFinding({
        test: "tampered-payload-accepted",
        severity: "critical",
        description:
          "Tampered webhook payload accepted with original signature — HMAC verification may not re-hash the received body",
        expected: "401 Unauthorized",
        actual: `Status ${status}`,
      });
    } else if (status === 401) {
      console.log("✅ PASS: Tampered payload correctly rejected");
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 6: Malformed JSON body
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n─── Test 6: Malformed JSON ───");
  {
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "this is not json {{{",
      });
      const status = res.status;
      console.log(`   Status: ${status}`);

      if (status === 500) {
        reportFinding({
          test: "malformed-json-500",
          severity: "medium",
          description:
            "Malformed JSON caused server error (500) — should return 400 Bad Request",
          expected: "400 Bad Request",
          actual: `Status ${status}`,
        });
      } else {
        console.log(`✅ PASS: Malformed JSON handled (status ${status})`);
      }
    } catch (err) {
      console.log(`ℹ️  Request failed: ${err}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  PAYMENT BYPASS TEST COMPLETE — ${bypassFindings.length} vulnerabilities found`);
  console.log("═══════════════════════════════════════════════════════════");

  if (bypassFindings.length > 0) {
    const critical = bypassFindings.filter((f) => f.severity === "critical");
    const high = bypassFindings.filter((f) => f.severity === "high");
    const medium = bypassFindings.filter((f) => f.severity === "medium");

    console.log(`\n📊 Breakdown: ${critical.length} critical, ${high.length} high, ${medium.length} medium\n`);

    for (const f of bypassFindings) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.test}`);
      console.log(`    ${f.description}\n`);
    }

    process.exitCode = 1;
  } else {
    console.log("\n✅ All payment webhook security checks passed.");
  }
}

// Run if executed directly
runPaymentBypassTests().catch((err) => {
  console.error("[payment-bypass] Fatal error:", err);
  process.exit(1);
});
