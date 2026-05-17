-- Migration: Add client portal fields to clients table
-- Adds email, portal_username, and plan columns for the client portal system

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS portal_username TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'diy';

-- Update RLS policies
DROP POLICY IF EXISTS "Super admins can manage all clients" ON public.clients;
CREATE POLICY "Super admins can manage all clients" ON public.clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Allow read for portal login" ON public.clients;
CREATE POLICY "Allow read for portal login" ON public.clients
  FOR SELECT
  USING (true);
