/**
 * Mock Payment Server
 *
 * A lightweight Express server that simulates Dodo Payments webhook endpoint.
 * Used by the payment bypass tester to verify webhook handling without
 * hitting the real payment processor.
 *
 * Usage: npx ts-node tests/utils/mock_payment_server.ts [port]
 * Default port: 3456
 */

import express from "express";
import crypto from "node:crypto";

const PORT = parseInt(process.argv[2] || process.env.MOCK_PAYMENT_PORT || "3456", 10);

const app = express();

// Parse raw body for signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  })
);

// ─── In-memory webhook store ──────────────────────────────────────────────────

interface StoredWebhook {
  id: string;
  timestamp: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

const webhooks: StoredWebhook[] = [];

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /webhook — Receive and log a payment webhook payload.
 * Simulates the Dodo webhook endpoint. Always returns 200.
 */
app.post("/webhook", (req, res) => {
  const id = crypto.randomBytes(8).toString("hex");
  const entry: StoredWebhook = {
    id,
    timestamp: new Date().toISOString(),
    headers: req.headers as Record<string, string | string[] | undefined>,
    body: req.body,
  };

  webhooks.push(entry);
  console.log(`[mock-payment] Webhook received: ${id}`);
  console.log(`[mock-payment] Event: ${(req.body as any)?.event || "unknown"}`);
  console.log(`[mock-payment] Total stored: ${webhooks.length}`);

  res.status(200).json({ received: true, id });
});

/**
 * GET /history — Return all received webhooks (newest first).
 */
app.get("/history", (_req, res) => {
  res.json({
    count: webhooks.length,
    webhooks: [...webhooks].reverse(),
  });
});

/**
 * GET /history/:id — Return a single webhook by ID.
 */
app.get("/history/:id", (req, res) => {
  const entry = webhooks.find((w) => w.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "Webhook not found" });
  }
  res.json(entry);
});

/**
 * DELETE /history — Clear all stored webhooks.
 */
app.delete("/history", (_req, res) => {
  const count = webhooks.length;
  webhooks.length = 0;
  res.json({ cleared: count });
});

/**
 * GET /health — Health check.
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🧪 Mock Payment Server running on http://localhost:${PORT}`);
  console.log(`   POST http://localhost:${PORT}/webhook  — Receive webhooks`);
  console.log(`   GET  http://localhost:${PORT}/history  — View all webhooks`);
  console.log(`   DEL  http://localhost:${PORT}/history  — Clear history`);
  console.log(`   GET  http://localhost:${PORT}/health   — Health check\n`);
});

export default app;
