-- supabase/migrations/20260517_phase4_guardrails.sql

-- ─── Phase 4 guardrails columns on agents ────────────────────────────────────
-- auto_approve_level: 'off' | 'medium' | 'high' — set by guardrails based on health score
-- consecutive_failures: resets to 0 on success; agent auto-disabled at 3
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS auto_approve_level TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0;
