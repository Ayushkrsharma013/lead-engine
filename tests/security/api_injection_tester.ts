/**
 * API Injection Tester
 *
 * Scans all API routes for injection vulnerabilities by sending malicious
 * payloads (SQL injection, command injection, parameter pollution) and
 * checking for unexpected responses or error leakage.
 *
 * Environment variables required:
 *   APP_URL — base URL of the app
 *   CRON_SECRET — cron secret for internal API auth
 */

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const BASE_PATH = "/prospecting-os";
const BASE = `${APP_URL}${BASE_PATH}`;
const CRON_SECRET = process.env.CRON_SECRET || "";

// ─── API route inventory ──────────────────────────────────────────────────────

interface ApiRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  requiresAuth: boolean;
  note?: string;
}

// All known API routes derived from the app/api/ directory
const API_ROUTES: ApiRoute[] = [
  // Public routes
  { method: "GET", path: "/api/appointments", requiresAuth: false },
  { method: "POST", path: "/api/appointments", requiresAuth: false },
  { method: "POST", path: "/api/payment/webhook", requiresAuth: false },
  { method: "POST", path: "/api/payment/create-checkout", requiresAuth: true },
  { method: "POST", path: "/api/landing/email-capture", requiresAuth: false },
  { method: "GET", path: "/api/auth/google-calendar", requiresAuth: true },
  { method: "GET", path: "/api/auth/google-calendar/callback", requiresAuth: false },
  { method: "GET", path: "/api/auth/google-calendar/status", requiresAuth: true },

  // Auth-required routes (x-user-id header)
  { method: "GET", path: "/api/me", requiresAuth: true },
  { method: "GET", path: "/api/leads", requiresAuth: true },
  { method: "POST", path: "/api/leads/generate", requiresAuth: true },
  { method: "GET", path: "/api/leads/generate", requiresAuth: true },
  { method: "GET", path: "/api/leads/status", requiresAuth: true },
  { method: "POST", path: "/api/leads/import", requiresAuth: true },
  { method: "POST", path: "/api/leads/capture", requiresAuth: true },
  { method: "POST", path: "/api/tools/icebreaker", requiresAuth: true },
  { method: "POST", path: "/api/tools/audit-request", requiresAuth: false },
  { method: "POST", path: "/api/onboarding/save", requiresAuth: true },
  { method: "POST", path: "/api/onboarding/token-save", requiresAuth: false },
  { method: "POST", path: "/api/chat/bot", requiresAuth: true },

  // Admin routes
  { method: "GET", path: "/api/admin/clients", requiresAuth: true },
  { method: "PATCH", path: "/api/admin/clients", requiresAuth: true },
  { method: "DELETE", path: "/api/admin/clients", requiresAuth: true },
  { method: "GET", path: "/api/admin/clients/metrics", requiresAuth: true },
  { method: "GET", path: "/api/admin/users", requiresAuth: true },
  { method: "GET", path: "/api/admin/me", requiresAuth: true },
  { method: "GET", path: "/api/admin/agents", requiresAuth: true },

  // Client portal routes
  { method: "GET", path: "/api/client-portal/me", requiresAuth: true },
  { method: "GET", path: "/api/client-portal/leads", requiresAuth: true },
  { method: "GET", path: "/api/client-portal/dashboard", requiresAuth: true },
  { method: "GET", path: "/api/client-portal/icebreakers", requiresAuth: true },
  { method: "GET", path: "/api/client-portal/connectors", requiresAuth: true },
  { method: "GET", path: "/api/client-portal/sequences", requiresAuth: true },
  { method: "GET", path: "/api/client-portal/team", requiresAuth: true },

  // Misc
  { method: "GET", path: "/api/filters", requiresAuth: true },
  { method: "POST", path: "/api/filters", requiresAuth: true },
  { method: "GET", path: "/api/sequences", requiresAuth: true },
  { method: "POST", path: "/api/sequences", requiresAuth: true },
  { method: "GET", path: "/api/user/settings", requiresAuth: true },
];

// ─── Payload definitions ──────────────────────────────────────────────────────

const SQL_INJECTION_PAYLOADS = [
  { name: "basic-tautology", value: "' OR 1=1 --" },
  { name: "drop-table", value: "'; DROP TABLE profiles; --" },
  { name: "union-select", value: "' UNION SELECT * FROM profiles --" },
  { name: "comment-out", value: "admin'--" },
  { name: "always-true", value: "' OR '1'='1" },
  { name: "batched", value: "'; UPDATE profiles SET role='admin' WHERE 1=1; --" },
  { name: "null-byte", value: "admin' OR 1=1\x00" },
  { name: "semicolon-break", value: "1'; DROP TABLE leads CASCADE; --" },
];

const COMMAND_INJECTION_PAYLOADS = [
  { name: "subshell", value: "$(whoami)" },
  { name: "backtick", value: "`whoami`" },
  { name: "pipe", value: "| whoami" },
  { name: "semicolon-cmd", value: "; whoami" },
  { name: "and-cmd", value: "&& whoami" },
  { name: "newline-cmd", value: "\nwhoami\n" },
];

const PARAMETER_POLLUTION_PAYLOADS = [
  { name: "double-param", value: "&email=admin@flow-forges.com&email=attacker@evil.com" },
  { name: "null-byte", value: "\x00" },
  { name: "crlf", value: "\x0d\x0a" },
  { name: "unicode-control", value: "\x00\x01\x02\x03\x04\x05" },
  { name: "very-long", value: "A".repeat(10000) },
  { name: "array-notation", value: "[]=bypass&email[]=admin" },
  { name: "json-injection", value: '{"$gt": ""}' },
];

// ─── Vulnerability report ─────────────────────────────────────────────────────

interface InjectionFinding {
  route: string;
  method: string;
  payloadName: string;
  payloadCategory: string;
  payload: string;
  status: number;
  responsePreview: string;
  severity: "critical" | "high" | "medium" | "low";
}

const findings: InjectionFinding[] = [];

function recordFinding(finding: InjectionFinding) {
  findings.push(finding);
  console.log(
    `\n🚨 [${finding.severity.toUpperCase()}] ${finding.method} ${finding.route}`
  );
  console.log(`   Payload: ${finding.payloadName} (${finding.payloadCategory})`);
  console.log(`   Status: ${finding.status}`);
  console.log(`   Response: ${finding.responsePreview.slice(0, 200)}`);
}

// ─── HTTP request helper ──────────────────────────────────────────────────────

async function sendRequest(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
  const url = `${BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (method !== "GET" && method !== "HEAD" && body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 500) };
  } catch (err) {
    return { status: 0, body: `Request failed: ${err}` };
  }
}

// ─── Test runner ──────────────────────────────────────────────────────────────

async function runInjectionTests() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  API INJECTION TESTER — Vulnerability Scanner");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log(`[scan] Testing ${API_ROUTES.length} API routes × ${SQL_INJECTION_PAYLOADS.length + COMMAND_INJECTION_PAYLOADS.length + PARAMETER_POLLUTION_PAYLOADS.length} payloads`);

  const authHeaders = {
    "x-user-id": "00000000-0000-0000-0000-000000000000",
    "x-user-email": "test@flow-forges-test.com",
    "x-user-role": "client",
  };

  let testedPayloads = 0;

  for (const route of API_ROUTES) {
    const headers = route.requiresAuth ? authHeaders : {};

    // ── SQL Injection ─────────────────────────────────────────────────────────
    for (const payload of SQL_INJECTION_PAYLOADS) {
      testedPayloads++;

      // Test as query parameter
      const qsPath = `${route.path}?q=${encodeURIComponent(payload.value)}`;
      const { status: qsStatus, body: qsBody } = await sendRequest(
        route.method,
        qsPath,
        undefined,
        headers
      );

      if (qsStatus === 500) {
        recordFinding({
          route: qsPath,
          method: route.method,
          payloadName: payload.name,
          payloadCategory: "SQL Injection (query string)",
          payload: payload.value,
          status: qsStatus,
          responsePreview: qsBody,
          severity: "high",
        });
      } else if (qsStatus === 200 && /error|exception|stack|trace/i.test(qsBody)) {
        recordFinding({
          route: qsPath,
          method: route.method,
          payloadName: payload.name,
          payloadCategory: "SQL Injection (query string)",
          payload: payload.value,
          status: qsStatus,
          responsePreview: qsBody,
          severity: "medium",
        });
      }

      // Test as JSON body for POST/PUT/PATCH
      if (["POST", "PUT", "PATCH"].includes(route.method)) {
        const injectionBody = {
          email: payload.value,
          name: payload.value,
          id: payload.value,
          search: payload.value,
        };
        const { status: bodyStatus, body: bodyResp } = await sendRequest(
          route.method,
          route.path,
          injectionBody,
          headers
        );

        if (bodyStatus === 500) {
          recordFinding({
            route: route.path,
            method: route.method,
            payloadName: payload.name,
            payloadCategory: "SQL Injection (JSON body)",
            payload: JSON.stringify(injectionBody),
            status: bodyStatus,
            responsePreview: bodyResp,
            severity: "high",
          });
        }
      }
    }

    // ── Command Injection ─────────────────────────────────────────────────────
    for (const payload of COMMAND_INJECTION_PAYLOADS) {
      testedPayloads++;

      const cmdBody = {
        name: payload.value,
        company: payload.value,
        email: `test${payload.value}@test.com`,
      };

      const { status, body } = await sendRequest(
        route.method,
        route.path,
        route.method !== "GET" ? cmdBody : undefined,
        headers
      );

      if (status === 500) {
        recordFinding({
          route: route.path,
          method: route.method,
          payloadName: payload.name,
          payloadCategory: "Command Injection",
          payload: payload.value,
          status,
          responsePreview: body,
          severity: "critical",
        });
      }
    }

    // ── Parameter Pollution ───────────────────────────────────────────────────
    for (const payload of PARAMETER_POLLUTION_PAYLOADS) {
      testedPayloads++;

      const pollutedPath = pathWithPollution(route.path, payload.value);
      const { status, body } = await sendRequest(
        route.method,
        pollutedPath,
        undefined,
        headers
      );

      if (status === 500) {
        recordFinding({
          route: pollutedPath,
          method: route.method,
          payloadName: payload.name,
          payloadCategory: "Parameter Pollution",
          payload: payload.value.length > 100 ? `${payload.value.slice(0, 100)}...` : payload.value,
          status,
          responsePreview: body,
          severity: "medium",
        });
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  SCAN COMPLETE — ${testedPayloads} payloads tested`);
  console.log(`  Vulnerabilities found: ${findings.length}`);
  console.log("═══════════════════════════════════════════════════════════");

  if (findings.length > 0) {
    // Group by severity
    const critical = findings.filter((f) => f.severity === "critical");
    const high = findings.filter((f) => f.severity === "high");
    const medium = findings.filter((f) => f.severity === "medium");

    console.log(`\n📊 Severity breakdown:`);
    console.log(`   Critical: ${critical.length}`);
    console.log(`   High: ${high.length}`);
    console.log(`   Medium: ${medium.length}`);

    for (const f of [...critical, ...high, ...medium]) {
      console.log(`\n  [${f.severity.toUpperCase()}] ${f.method} ${f.route}`);
      console.log(`  Payload: ${f.payloadName} (${f.payloadCategory})`);
      console.log(`  Response: ${f.status} — ${f.responsePreview.slice(0, 100)}`);
    }

    process.exitCode = 1;
  } else {
    console.log("\n✅ No injection vulnerabilities detected.");
  }
}

// Helper: add parameter pollution to a URL path
function pathWithPollution(basePath: string, pollution: string): string {
  const sep = basePath.includes("?") ? "&" : "?";
  // URL-encode the pollution value except for control chars
  const safe = pollution.replace(/[^\x20-\x7e]/g, (c) =>
    encodeURIComponent(c)
  );
  return `${basePath}${sep}polluted=${encodeURIComponent(safe)}`;
}

// Run if executed directly
runInjectionTests().catch((err) => {
  console.error("[injection] Fatal error:", err);
  process.exit(1);
});
