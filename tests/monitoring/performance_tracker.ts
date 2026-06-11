/**
 * Performance Tracker
 *
 * A cron-friendly Node script that calls key API endpoints, records response
 * times and success rates in a local SQLite database, and alerts when
 * metrics deviate more than 2 standard deviations from historical averages.
 *
 * Upon detecting anomalies, exits with code 1 to trigger CI/CD alerts.
 *
 * Usage:
 *   npx ts-node tests/monitoring/performance_tracker.ts
 *
 * Database: tests/monitoring/metrics.db (SQLite, auto-created)
 *
 * Environment variables:
 *   APP_URL — base URL of the app (required)
 *   CRON_SECRET — for internal API auth (required)
 *   TEST_WORKSPACE_ID — test workspace for lead generation test
 */

import Database from "better-sqlite3";
import path from "node:path";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const BASE_PATH = "/prospecting-os";
const BASE = `${APP_URL}${BASE_PATH}`;
const CRON_SECRET = process.env.CRON_SECRET || "";

const DB_PATH = path.join(__dirname, "metrics.db");

// ─── Database Setup ───────────────────────────────────────────────────────────

interface MetricRow {
  id: number;
  metric_name: string;
  value: number;
  unit: string;
  status: string;
  recorded_at: string;
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma("journal_mode = WAL");

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'ms',
    status TEXT NOT NULL DEFAULT 'ok',
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_metrics_name_time
  ON metrics(metric_name, recorded_at)
`);

// ─── Metric recording ─────────────────────────────────────────────────────────

const insertMetric = db.prepare(`
  INSERT INTO metrics (metric_name, value, unit, status, recorded_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`);

function recordMetric(name: string, value: number, unit: string = "ms", status: string = "ok") {
  insertMetric.run(name, value, unit, status);
  console.log(`  [metric] ${name}: ${value}${unit} (${status})`);
}

// ─── Anomaly detection ────────────────────────────────────────────────────────

interface Stats {
  count: number;
  avg: number;
  stddev: number;
}

function computeStats(metricName: string, lookbackHours: number = 24): Stats {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count, AVG(value) as avg,
              COALESCE(
                (SELECT AVG((value - sub.avg) * (value - sub.avg))
                 FROM metrics,
                      (SELECT AVG(value) as avg
                       FROM metrics
                       WHERE metric_name = ?
                         AND recorded_at >= datetime('now', ? || ' hours')) as sub
                 WHERE metric_name = ?
                   AND recorded_at >= datetime('now', ? || ' hours')),
                0
              ) as variance
       FROM metrics
       WHERE metric_name = ?
         AND recorded_at >= datetime('now', ? || ' hours')`
    )
    .get(metricName, -lookbackHours, metricName, -lookbackHours, metricName, -lookbackHours) as {
    count: number;
    avg: number | null;
    variance: number | null;
  };

  const count = row?.count ?? 0;
  const avg = row?.avg ?? 0;
  const stddev = Math.sqrt(Math.abs(row?.variance ?? 0));

  return { count, avg, stddev };
}

function isAnomaly(value: number, stats: Stats): boolean {
  if (stats.count < 5) return false; // Need enough data
  const threshold = 2 * stats.stddev;
  return Math.abs(value - stats.avg) > threshold;
}

// ─── API probes ───────────────────────────────────────────────────────────────

async function probeApi(
  name: string,
  method: string,
  path: string,
  headers: Record<string, string> = {}
): Promise<{ duration: number; status: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
    const duration = Date.now() - start;
    console.log(`  ${method} ${path} → ${res.status} (${duration}ms)`);
    return { duration, status: res.status };
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`  ${method} ${path} → ERROR (${duration}ms): ${err}`);
    return { duration, status: 0 };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runPerformanceCheck() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  PERFORMANCE TRACKER — ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  let anomaliesFound = 0;

  // ── Probe 1: GET /api/admin/clients (list endpoint response time) ──────────
  console.log("─── Probe: Admin clients list ───");
  {
    const { duration, status } = await probeApi("admin-clients-list", "GET", "/api/admin/clients", {
      "x-user-id": "00000000-0000-0000-0000-000000000000",
      "x-user-email": "monitor@flow-forges-test.com",
      "x-user-role": "super_admin",
    });

    recordMetric("api_admin_clients_latency", duration, "ms", status === 200 ? "ok" : "error");

    const stats = computeStats("api_admin_clients_latency");
    if (isAnomaly(duration, stats)) {
      console.log(`  ⚠️  ANOMALY: ${duration}ms vs avg ${Math.round(stats.avg)}ms (±${Math.round(stats.stddev * 2)}ms)`);
      anomaliesFound++;
    }
  }

  // ── Probe 2: GET /api/leads/generate (status check) ────────────────────────
  console.log("\n─── Probe: Lead generation status ───");
  {
    const workspaceId = process.env.TEST_WORKSPACE_ID || "00000000-0000-0000-0000-000000000000";
    const { duration, status } = await probeApi(
      "leads-status",
      "GET",
      `/api/leads/generate?workspace_id=${workspaceId}`,
      { Authorization: `Bearer ${CRON_SECRET}` }
    );

    recordMetric("api_leads_status_latency", duration, "ms", status === 200 ? "ok" : "error");

    const stats = computeStats("api_leads_status_latency");
    if (isAnomaly(duration, stats)) {
      console.log(`  ⚠️  ANOMALY: ${duration}ms vs avg ${Math.round(stats.avg)}ms`);
      anomaliesFound++;
    }
  }

  // ── Probe 3: GET /api/admin/clients/metrics (metrics endpoint) ─────────────
  console.log("\n─── Probe: Admin metrics ───");
  {
    const { duration, status } = await probeApi("admin-metrics", "GET", "/api/admin/clients/metrics", {
      "x-user-role": "super_admin",
    });

    recordMetric("api_admin_metrics_latency", duration, "ms", status === 200 ? "ok" : "error");

    const stats = computeStats("api_admin_metrics_latency");
    if (isAnomaly(duration, stats)) {
      console.log(`  ⚠️  ANOMALY: ${duration}ms vs avg ${Math.round(stats.avg)}ms`);
      anomaliesFound++;
    }
  }

  // ── Probe 4: GET /api/me (authenticated user check) ────────────────────────
  console.log("\n─── Probe: User profile endpoint ───");
  {
    const { duration, status } = await probeApi("user-profile", "GET", "/api/me", {
      "x-user-id": "00000000-0000-0000-0000-000000000000",
      "x-user-role": "client",
    });

    recordMetric("api_me_latency", duration, "ms", status === 200 ? "ok" : "error");

    const stats = computeStats("api_me_latency");
    if (isAnomaly(duration, stats)) {
      console.log(`  ⚠️  ANOMALY: ${duration}ms vs avg ${Math.round(stats.avg)}ms`);
      anomaliesFound++;
    }
  }

  // ── Database stats ─────────────────────────────────────────────────────────
  const totalMetrics = (
    db.prepare("SELECT COUNT(*) as count FROM metrics").get() as { count: number }
  ).count;

  console.log(`\n─── Database: ${totalMetrics} total metrics stored in ${DB_PATH}`);

  // ── Cleanup old metrics (keep last 30 days) ────────────────────────────────
  const deleted = db
    .prepare("DELETE FROM metrics WHERE recorded_at < datetime('now', '-30 days')")
    .run();
  if (deleted.changes > 0) {
    console.log(`  [cleanup] Removed ${deleted.changes} metrics older than 30 days`);
  }

  // ── Final verdict ──────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  ${anomaliesFound > 0 ? "⚠️  ANOMALIES DETECTED" : "✅ ALL METRICS NORMAL"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (anomaliesFound > 0) {
    process.exitCode = 1;
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

runPerformanceCheck()
  .catch((err) => {
    console.error("[performance] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
