-- Client Portal Migration
-- Run this in the Supabase SQL Editor

-- 1. Add portal_password to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_password TEXT;

-- 2. Add client_id to leads table (to scope leads to a specific client)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 3. Set a default portal password for existing clients (change these!)
-- Example: UPDATE clients SET portal_password = 'changeme123' WHERE portal_password IS NULL;

-- 4. Create index on client_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);

-- 5. Appointments table (demo bookings from landing page /book + Pros Bot)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  type TEXT DEFAULT 'demo',
  duration INTEGER DEFAULT 30,
  status TEXT DEFAULT 'confirmed',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  calendar_link TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Email captures table (landing page email modal)
CREATE TABLE IF NOT EXISTS email_captures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Add new columns to existing appointments table (if it already exists)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'demo';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS calendar_link TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 8. RLS policies for appointments (allow public insert/select/update)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon_insert_appointments" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_select_appointments" ON appointments FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "anon_update_appointments" ON appointments FOR UPDATE USING (true) WITH CHECK (true);

-- 9. RLS policies for email_captures (allow public insert)
ALTER TABLE email_captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_email_captures" ON email_captures FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_email_captures" ON email_captures FOR SELECT USING (true);
