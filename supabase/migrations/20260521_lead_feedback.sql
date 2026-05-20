-- Migration: lead_feedback table + profiles quota/budget columns
-- Date: 2026-05-21

-- ─── lead_feedback ─────────────────────────────────────────────────────────────
-- Stores per-user thumbs-up/down feedback on leads, with extracted keyword weights.
-- Rows are upserted on (user_id, keyword) — weight accumulates over time.

CREATE TABLE IF NOT EXISTS public.lead_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id     TEXT NOT NULL,
  feedback    BOOLEAN NOT NULL,         -- true = good, false = bad
  keyword     TEXT NOT NULL,            -- extracted from title / industry
  weight      INT  NOT NULL DEFAULT 0,  -- cumulative weight for this keyword
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookups by user + keyword for suggestion queries
CREATE INDEX IF NOT EXISTS lead_feedback_user_keyword_idx
  ON public.lead_feedback (user_id, keyword);

-- Deduplicate per (user, lead, keyword) so re-voting updates in place
CREATE UNIQUE INDEX IF NOT EXISTS lead_feedback_user_lead_keyword_idx
  ON public.lead_feedback (user_id, lead_id, keyword);

-- ─── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.lead_feedback ENABLE ROW LEVEL SECURITY;

-- Users can read their own feedback
CREATE POLICY "lead_feedback_select_own"
  ON public.lead_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "lead_feedback_insert_own"
  ON public.lead_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback (for re-votes)
CREATE POLICY "lead_feedback_update_own"
  ON public.lead_feedback FOR UPDATE
  USING (auth.uid() = user_id);

-- super_admin can read all feedback (for analytics)
CREATE POLICY "lead_feedback_admin_select"
  ON public.lead_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- ─── profiles: quota + budget columns ─────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lead_quota_target  INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS budget_cap_cents   INT NOT NULL DEFAULT 500;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.lead_quota_target IS 'Target number of new leads per scrape run (default 100)';
COMMENT ON COLUMN public.profiles.budget_cap_cents   IS 'Max spend per scrape run in cents (default 500 = $5)';
COMMENT ON TABLE  public.lead_feedback               IS 'Thumbs up/down feedback on leads with extracted keyword weights for filter improvement';
