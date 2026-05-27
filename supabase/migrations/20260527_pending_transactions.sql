-- Phase 3 — pending_transactions reconciliation table.
-- Created by /api/payment/create-checkout on every initiated payment.
-- Consumed by /api/payment/webhook to provision the client.
-- Cleaned up by the webhook after successful activation.

CREATE TABLE IF NOT EXISTS pending_transactions (
  txnid TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_transactions_user_id
  ON pending_transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_pending_transactions_created_at
  ON pending_transactions (created_at DESC);

ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;

-- Service role only — webhook + create-checkout both run with supabaseAdmin.
DROP POLICY IF EXISTS "service_role_all_pending_txns" ON pending_transactions;
CREATE POLICY "service_role_all_pending_txns"
  ON pending_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- super_admin can read for the smoke endpoint + finance dashboards.
DROP POLICY IF EXISTS "super_admin_read_pending_txns" ON pending_transactions;
CREATE POLICY "super_admin_read_pending_txns"
  ON pending_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );
