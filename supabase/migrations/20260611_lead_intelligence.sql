-- Lead Intelligence & Secure Portal Display
-- Per-client workspace-scoped leads + icebreakers tables

-- 1. Client leads table (workspace-scoped, NOT global leads table)
CREATE TABLE IF NOT EXISTS client_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES client_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  email TEXT, -- stored but NEVER returned to client portal UI
  score DECIMAL(3,1) DEFAULT 0 CHECK (score >= 0 AND score <= 10),
  icp_match_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  month_year DATE DEFAULT date_trunc('month', now())
);

-- 2. Client icebreakers table (one per lead)
CREATE TABLE IF NOT EXISTS client_icebreakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES client_leads(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Workspace columns for lead generation tracking
ALTER TABLE client_workspaces ADD COLUMN IF NOT EXISTS leads_generation_status TEXT DEFAULT 'pending';
ALTER TABLE client_workspaces ADD COLUMN IF NOT EXISTS leads_generated_at TIMESTAMPTZ;
ALTER TABLE client_workspaces ADD COLUMN IF NOT EXISTS icp_locked BOOLEAN DEFAULT false;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_client_leads_workspace ON client_leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_leads_score ON client_leads(workspace_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_client_leads_created ON client_leads(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_icebreakers_lead ON client_icebreakers(lead_id);

-- 5. RLS policies
ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_icebreakers ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (supabaseAdmin bypasses RLS)
-- Client users access via API with workspace-level filtering
CREATE POLICY "Service role full access on client_leads"
  ON client_leads FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on client_icebreakers"
  ON client_icebreakers FOR ALL USING (true)
  WITH CHECK (true);
