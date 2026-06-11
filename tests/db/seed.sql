-- ============================================================================
-- Prospecting OS — Test Database Seed Data
-- Creates minimal test data for E2E and security test scenarios.
-- All emails use @flow-forges-test.com domain for easy cleanup.
-- ============================================================================

-- ─── Test Super Admin ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO profiles (id, email, display_name, role, plan, subscription_status, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@flow-forges-test.com', 'Test Admin', 'super_admin', NULL, 'active', 1);

-- ─── Test Client (pre-onboarding) ───────────────────────────────────────────
INSERT OR IGNORE INTO profiles (id, email, display_name, role, plan, subscription_status, is_active)
VALUES ('00000000-0000-0000-0000-000000000002', 'test-client@flow-forges-test.com', 'Test Client', 'client', 'micro', 'inactive', 1);

INSERT OR IGNORE INTO clients (id, user_id, name, company, industry, monthly_retainer, status, email, plan)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'Test Client', 'Test Corp', 'SaaS', 0, 'pending', 'test-client@flow-forges-test.com', 'micro');

-- ─── Test Workspace ─────────────────────────────────────────────────────────
INSERT OR IGNORE INTO client_workspaces (id, client_user_id, plan, icp_config, leads_generation_status, leads_count)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000002',
  'micro',
  '{"industries":["SaaS","FinTech"],"companySizes":["11-50","51-200"],"seniority":["VP / Director","C-Suite (CEO, CTO, CFO)"],"countries":["United States","Canada"]}',
  'pending',
  0
);

-- ─── Test Appointment (pending) ─────────────────────────────────────────────
INSERT OR IGNORE INTO appointments (id, date, time, name, email, company, status, plan, onboarding_token)
VALUES (
  '00000000-0000-0000-0000-000000000200',
  date('now', '+1 day'),
  '10:00',
  'Test Prospect',
  'test-prospect@flow-forges-test.com',
  'ACME Inc',
  'confirmed',
  'micro',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
);

-- ─── Sample Leads (for portal tests) ────────────────────────────────────────
INSERT OR IGNORE INTO client_leads (id, workspace_id, name, title, company, linkedin_url, score, icp_match_reason)
VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000100', 'Sarah Chen', 'VP Engineering', 'TechFlow Solutions', 'https://linkedin.com/in/sarahchen', 9.2, 'Seniority match; LinkedIn profile; Verified email; Industry match'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000100', 'Marcus Rivera', 'CTO', 'PeakDigital Media', 'https://linkedin.com/in/mrivera', 8.7, 'Seniority match; LinkedIn profile; Industry match'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000100', 'Jordan Park', 'Director Sales', 'GreenPath Analytics', 'https://linkedin.com/in/jpark', 8.1, 'Seniority match; LinkedIn profile');

-- ─── Sample Icebreakers ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO client_icebreakers (id, lead_id, workspace_id, text)
VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000100', 'Hi Sarah, saw your recent talk on scaling engineering teams at SaaS Conf — impressive insights on remote-first culture. Would love to connect.'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000100', 'Marcus, noticed PeakDigital just raised Series A — congratulations! Curious how you''re approaching outbound at this stage.'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000100', 'Jordan, love what GreenPath is doing in renewable analytics. Would be great to exchange notes on enterprise sales.');
