-- supabase/migrations/20260517_phase3_knowledge_store.sql

-- ─── knowledge_store ─────────────────────────────────────────────────────────
-- Shared learning table: agents read/write ICP signals, reply rates, stale patterns
CREATE TABLE IF NOT EXISTS knowledge_store (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}',
  agent      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (key, agent)
);

ALTER TABLE knowledge_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_knowledge_store" ON knowledge_store FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));
