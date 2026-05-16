CREATE TABLE IF NOT EXISTS audit_requests (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  company          TEXT NOT NULL,
  website          TEXT,
  team_size        TEXT,
  weekly_hours     TEXT,
  current_tool     TEXT,
  icp_description  TEXT,
  csv_filename     TEXT,
  csv_data         TEXT,
  status           TEXT DEFAULT 'pending',
  result_sheet_url TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_requests_email   ON audit_requests(email);
CREATE INDEX IF NOT EXISTS idx_audit_requests_status  ON audit_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_requests_created ON audit_requests(created_at DESC);

ALTER TABLE audit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert" ON audit_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_all" ON audit_requests FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'qa_agent')
  )
);
