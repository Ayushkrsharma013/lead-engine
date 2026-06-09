-- Migration: RLS policies for appointments and email_captures
-- Ensures public booking + admin management works across all clients

-- Appointments: allow public inserts (booking), authenticated reads/updates
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert appointments" ON public.appointments;
CREATE POLICY "Anyone can insert appointments" ON public.appointments
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;
CREATE POLICY "Authenticated users can view appointments" ON public.appointments
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super admins can manage all appointments" ON public.appointments;
CREATE POLICY "Super admins can manage all appointments" ON public.appointments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Email captures: allow public inserts (landing page forms)
ALTER TABLE public.email_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert email captures" ON public.email_captures;
CREATE POLICY "Anyone can insert email captures" ON public.email_captures
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Super admins can view email captures" ON public.email_captures;
CREATE POLICY "Super admins can view email captures" ON public.email_captures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
