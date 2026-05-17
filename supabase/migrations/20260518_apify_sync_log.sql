-- apify_sync_log table — tracks historical sync runs
CREATE TABLE IF NOT EXISTS public.apify_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES auth.users(id),
  runs_processed INTEGER DEFAULT 0,
  leads_found INTEGER DEFAULT 0,
  leads_imported INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_log JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.apify_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_apify_sync_log"
ON public.apify_sync_log
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Add Apify run tracking columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS apify_run_id TEXT,
  ADD COLUMN IF NOT EXISTS apify_dataset_id TEXT,
  ADD COLUMN IF NOT EXISTS sync_batch_id UUID;

-- Score-based query indexes
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_score_status ON public.leads(score, status);

-- Dedup by email index
CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON public.leads(lower(email));
