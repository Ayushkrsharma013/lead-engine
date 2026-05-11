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
