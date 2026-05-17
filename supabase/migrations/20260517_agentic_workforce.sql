-- supabase/migrations/20260517_agentic_workforce.sql

-- ─── agents ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  enabled         BOOLEAN NOT NULL DEFAULT false,
  schedule        TEXT NOT NULL DEFAULT '0 7 * * *',
  last_run_at     TIMESTAMPTZ,
  last_run_status TEXT,
  health_score    INT NOT NULL DEFAULT 100,
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── agent_actions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name      TEXT NOT NULL,
  batch_run_id    UUID NOT NULL,
  action_type     TEXT NOT NULL,
  description     TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  risk_level      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  notified_via    TEXT[] NOT NULL DEFAULT '{}',
  telegram_msg_id TEXT,
  approved_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

-- ─── agent_runs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name           TEXT NOT NULL,
  batch_run_id         UUID NOT NULL,
  started_at           TIMESTAMPTZ NOT NULL,
  completed_at         TIMESTAMPTZ,
  duration_ms          INT,
  outcome              TEXT NOT NULL DEFAULT 'success',
  safe_actions_count   INT NOT NULL DEFAULT 0,
  risky_actions_queued INT NOT NULL DEFAULT 0,
  log                  TEXT NOT NULL DEFAULT '',
  error                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS agent_runs_batch_idx
  ON agent_runs (batch_run_id);
CREATE INDEX IF NOT EXISTS agent_runs_agent_created_idx
  ON agent_runs (agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_actions_status_idx
  ON agent_actions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_actions_batch_idx
  ON agent_actions (batch_run_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_select_agents" ON agents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

CREATE POLICY "super_admin_update_agents" ON agents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

CREATE POLICY "super_admin_select_agent_actions" ON agent_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

CREATE POLICY "super_admin_select_agent_runs" ON agent_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

-- ─── Seed: 8 agents ──────────────────────────────────────────────────────────
INSERT INTO agents (name, display_name, description, enabled, schedule) VALUES
  ('lead-scout',       'Lead Scout',       'Daily Apify scrape, dedup, and ICP scoring',       false, '0 7 * * *'),
  ('outreach-agent',   'Outreach Agent',   'Sequence execution, email sends, reply handling',   false, '0 8 * * *'),
  ('pipeline-manager', 'Pipeline Manager', 'Kanban health, stale lead detection, cleanup',      false, '0 9 * * *'),
  ('icp-analyst',      'ICP Analyst',      'Score calibration and ICP pattern detection',       false, '0 8 * * 0'),
  ('client-reporter',  'Client Reporter',  'Auto-generates client portal updates and reports',  false, '0 8 * * 0'),
  ('finance-watcher',  'Finance Watcher',  'Payment tracking, MRR, activation (already live)', true,  '0 9 * * *'),
  ('data-janitor',     'Data Janitor',     'Lead dedup, archival, and DB health maintenance',   false, '0 4 * * *'),
  ('message-coach',    'Message Coach',    'A/B winner detection and message refinement',       false, '0 10 * * *')
ON CONFLICT (name) DO NOTHING;
