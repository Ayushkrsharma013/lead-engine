-- linkedin_queue: stores pending/executed LinkedIn actions
-- Note: sequence_execution_id is a plain UUID (no FK) because sequence_executions
-- may not exist on all environments; the runner joins lazily at query time.
CREATE TABLE IF NOT EXISTS public.linkedin_queue (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               TEXT NOT NULL,
  sequence_execution_id UUID,
  action_type           TEXT NOT NULL CHECK (action_type IN ('connection_request', 'dm', 'follow_up', 'profile_view')),
  message               TEXT,
  linkedin_profile_url  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'executing', 'done', 'failed', 'skipped')),
  scheduled_for         TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at           TIMESTAMPTZ,
  error                 TEXT,
  user_id               UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.linkedin_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_linkedin_queue"
  ON public.linkedin_queue FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Index used by the runner's polling query
CREATE INDEX IF NOT EXISTS idx_linkedin_queue_status_scheduled
  ON public.linkedin_queue(status, scheduled_for)
  WHERE status = 'pending';

-- linkedin_daily_stats: runner writes daily action counts; dashboard reads them
CREATE TABLE IF NOT EXISTS public.linkedin_daily_stats (
  date             TEXT PRIMARY KEY,
  connections_sent INT NOT NULL DEFAULT 0,
  dms_sent         INT NOT NULL DEFAULT 0,
  profile_views    INT NOT NULL DEFAULT 0,
  last_run_at      TIMESTAMPTZ
);

ALTER TABLE public.linkedin_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_linkedin_daily_stats"
  ON public.linkedin_daily_stats FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Allow sequence_messages.status = 'queued' for LinkedIn steps
-- Guarded: sequence_messages may not exist in all environments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sequence_messages'
  ) THEN
    ALTER TABLE public.sequence_messages
      DROP CONSTRAINT IF EXISTS sequence_messages_status_check;
    ALTER TABLE public.sequence_messages
      ADD CONSTRAINT sequence_messages_status_check
      CHECK (status IN ('sent', 'failed', 'bounced', 'skipped', 'replied', 'queued'));
  END IF;
END $$;
