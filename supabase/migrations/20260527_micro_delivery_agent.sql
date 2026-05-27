-- Phase 3.4 — register Micro Delivery Watcher agent
-- Runs daily at 7 AM via /api/agents/run; flags $997 micro-offer profiles
-- that have not received their 50 leads within 4 business days of activation.

INSERT INTO agents (name, display_name, description, enabled, schedule, config)
VALUES (
  'micro-delivery',
  'Micro Delivery Watcher',
  'Alerts on overdue $997 micro-offer fulfillment (50 leads in 5 business days)',
  true,
  '0 7 * * *',
  '{}'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  schedule = EXCLUDED.schedule;
