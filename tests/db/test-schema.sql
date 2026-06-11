-- ============================================================================
-- Prospecting OS — Isolated Test Database Schema (SQLite)
-- Mirrors the core Supabase tables needed for testing.
-- Runs in CI without requiring a Supabase branch (Free plan compatible).
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Core Tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  full_name TEXT DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client'
    CHECK (role IN ('super_admin', 'client', 'user', 'qa_agent')),
  plan TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_activated_at TEXT,
  onboarding_complete INTEGER DEFAULT 0,
  icp_preferences TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  payment_ref TEXT,
  payment_method TEXT DEFAULT 'ach',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  created_by TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id),
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  monthly_retainer INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  email TEXT DEFAULT '',
  portal_username TEXT,
  portal_password TEXT,
  plan TEXT DEFAULT 'diy',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_workspaces (
  id TEXT PRIMARY KEY,
  client_user_id TEXT REFERENCES profiles(id),
  plan TEXT NOT NULL,
  icp_config TEXT DEFAULT '{}',
  leads_count INTEGER DEFAULT 0,
  leads_generation_status TEXT DEFAULT 'pending'
    CHECK (leads_generation_status IN ('pending', 'processing', 'ready', 'failed')),
  leads_generated_at TEXT,
  icp_locked INTEGER DEFAULT 0,
  last_sync_at TEXT,
  connector_config TEXT,
  settings TEXT DEFAULT '{}',
  slack_webhook TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  type TEXT DEFAULT 'demo',
  duration INTEGER DEFAULT 30,
  status TEXT DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'pending', 'won', 'lost', 'cancelled', 'rescheduled')),
  timezone TEXT DEFAULT 'Asia/Kolkata',
  calendar_link TEXT,
  plan TEXT,
  onboarding_token TEXT,
  onboarding_sent_at TEXT,
  payment_status TEXT DEFAULT 'pending',
  icp_config TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_leads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES client_workspaces(id),
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  email TEXT,
  score NUMERIC DEFAULT 0 CHECK (score >= 0 AND score <= 10),
  icp_match_reason TEXT,
  month_year TEXT DEFAULT (date('now', 'start of month')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_icebreakers (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES client_leads(id),
  workspace_id TEXT REFERENCES client_workspaces(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_transactions (
  txnid TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id),
  plan TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  title TEXT DEFAULT '',
  company TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  location TEXT DEFAULT '',
  email TEXT DEFAULT '',
  email_status TEXT DEFAULT 'not_found'
    CHECK (email_status IN ('verified', 'risky', 'not_found')),
  linkedin TEXT DEFAULT '',
  website TEXT DEFAULT '',
  company_size TEXT DEFAULT '',
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  source TEXT DEFAULT 'linkedin'
    CHECK (source IN ('linkedin', 'gmaps', 'amazon')),
  tags TEXT DEFAULT '[]',
  kanban_column TEXT DEFAULT 'New',
  status TEXT,
  notes TEXT,
  last_touched TEXT,
  saved_at TEXT,
  fetched_at TEXT,
  client_id TEXT,
  apify_run_id TEXT,
  apify_dataset_id TEXT,
  sync_batch_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  tone TEXT DEFAULT '',
  message_type TEXT DEFAULT 'email',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  steps TEXT DEFAULT '[]',
  assigned_lead_ids TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequence_executions (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL REFERENCES sequences(id),
  lead_id TEXT NOT NULL,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  variant TEXT DEFAULT 'A',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_action_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequence_messages (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  step_index INTEGER DEFAULT 0,
  channel TEXT DEFAULT 'email',
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  status TEXT DEFAULT 'sent',
  resend_id TEXT,
  variant TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'notification',
  text TEXT NOT NULL DEFAULT '',
  lead_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS apify_sync_log (
  id TEXT PRIMARY KEY,
  triggered_by TEXT,
  runs_processed INTEGER DEFAULT 0,
  leads_found INTEGER DEFAULT 0,
  leads_imported INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_log TEXT DEFAULT '[]',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS micro_deliveries (
  id TEXT PRIMARY KEY,
  client_user_id TEXT REFERENCES profiles(id),
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  leads_count INTEGER DEFAULT 50,
  delivered_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_client ON client_workspaces(client_user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON client_workspaces(leads_generation_status);
CREATE INDEX IF NOT EXISTS idx_appointments_email ON appointments(email);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_client_leads_workspace ON client_leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_leads_score ON client_leads(score);
CREATE INDEX IF NOT EXISTS idx_icebreakers_lead ON client_icebreakers(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);

-- ─── Views ──────────────────────────────────────────────────────────────────

-- Client workspace summary view (used by admin dashboard)
CREATE VIEW IF NOT EXISTS workspace_summary AS
SELECT
  cw.id AS workspace_id,
  cw.client_user_id,
  p.email,
  p.display_name,
  p.subscription_status,
  cw.plan,
  cw.leads_count,
  cw.leads_generation_status,
  cw.created_at
FROM client_workspaces cw
LEFT JOIN profiles p ON p.id = cw.client_user_id;
