-- supabase/migrations/20260521_gmaps_outreach.sql

-- Queue table for outreach actions
CREATE TABLE IF NOT EXISTS gmaps_outreach_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action_type    TEXT NOT NULL CHECK (action_type IN ('contact_form_fill', 'sms_follow_up')),
  website_url    TEXT,
  phone          TEXT,
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'executing', 'done', 'failed', 'skipped')),
  step_number    INT NOT NULL DEFAULT 1,
  scheduled_for  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at    TIMESTAMPTZ,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, step_number)
);

ALTER TABLE gmaps_outreach_queue ENABLE ROW LEVEL SECURITY;

-- Partial unique index: only one pending/executing row per lead per action type
CREATE UNIQUE INDEX IF NOT EXISTS gmaps_queue_no_dup_pending
  ON gmaps_outreach_queue (lead_id, action_type)
  WHERE status IN ('pending', 'executing');

-- Daily stats table
CREATE TABLE IF NOT EXISTS gmaps_outreach_stats (
  date            TEXT PRIMARY KEY,
  forms_queued    INT NOT NULL DEFAULT 0,
  forms_sent      INT NOT NULL DEFAULT 0,
  sms_sent        INT NOT NULL DEFAULT 0,
  meetings_booked INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gmaps_outreach_stats ENABLE ROW LEVEL SECURITY;

-- Register agent in the agents table
INSERT INTO agents (name, display_name, description, enabled, schedule, health_score, config)
VALUES (
  'gmaps-outreach-agent',
  'GMap Outreach Agent',
  'Queues contact form fills and SMS follow-ups for Google Maps businesses to sell Missed Call Recovery ($297 setup + $97/mo)',
  true,
  '0 7 * * *',
  100,
  '{"daily_cap": 30, "sms_cap": 20}'
)
ON CONFLICT (name) DO NOTHING;
