-- 20260612_security_fixes.sql
-- Security critical fixes from SYSTEM_AUDIT_REPORT.md
-- Applies RLS hardening + missing indexes

-- ── 1. Enable RLS on gmaps_outreach_queue ────────────────────────────────
ALTER TABLE IF EXISTS public.gmaps_outreach_queue ENABLE ROW LEVEL SECURITY;

-- Drop any existing policy to be safe, then create service_role-only policy
DROP POLICY IF EXISTS service_role_all ON public.gmaps_outreach_queue;
CREATE POLICY service_role_all ON public.gmaps_outreach_queue
  FOR ALL TO service_role
  USING (true);

-- ── 2. Fix paddle_subscriptions policy — was public, should be service_role ──
DROP POLICY IF EXISTS service_role_all_subs ON public.paddle_subscriptions;
CREATE POLICY service_role_all_subs ON public.paddle_subscriptions
  FOR ALL TO service_role
  USING (true);

-- ── 3. Fix paddle_transactions policy — was public, should be service_role ──
DROP POLICY IF EXISTS service_role_all_txns ON public.paddle_transactions;
CREATE POLICY service_role_all_txns ON public.paddle_transactions
  FOR ALL TO service_role
  USING (true);

-- ── 4. Add workspace-scoped SELECT for client_leads ──────────────────────
DROP POLICY IF EXISTS workspace_select ON public.client_leads;
CREATE POLICY workspace_select ON public.client_leads
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM public.client_workspaces WHERE client_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_role_all ON public.client_leads;
CREATE POLICY service_role_all ON public.client_leads
  FOR ALL TO service_role
  USING (true);

-- ── 5. Add workspace-scoped SELECT for client_icebreakers ─────────────────
DROP POLICY IF EXISTS workspace_select ON public.client_icebreakers;
CREATE POLICY workspace_select ON public.client_icebreakers
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM public.client_workspaces WHERE client_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_role_all ON public.client_icebreakers;
CREATE POLICY service_role_all ON public.client_icebreakers
  FOR ALL TO service_role
  USING (true);

-- ── 6. Add service_role-only policy for pending_transactions ──────────────
DROP POLICY IF EXISTS service_role_all ON public.pending_transactions;
CREATE POLICY service_role_all ON public.pending_transactions
  FOR ALL TO service_role
  USING (true);

-- ── 7. Add workspace-scoped SELECT for micro_deliveries ──────────────────
DROP POLICY IF EXISTS workspace_select ON public.micro_deliveries;
CREATE POLICY workspace_select ON public.micro_deliveries
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM public.client_workspaces WHERE client_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_role_all ON public.micro_deliveries;
CREATE POLICY service_role_all ON public.micro_deliveries
  FOR ALL TO service_role
  USING (true);

-- ── 8. Revoke anon EXECUTE on get_user_role(), grant to authenticated ────
-- anon inherits from PUBLIC, so we must revoke from PUBLIC first
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO service_role;

-- ── 9. Missing indexes (Section 3.4 of audit report) ────────────────────
-- Critical: Client dashboard — most frequent query path
CREATE INDEX IF NOT EXISTS idx_client_leads_workspace_score
  ON public.client_leads (workspace_id, score DESC);

-- Critical: Icebreaker lookups
CREATE INDEX IF NOT EXISTS idx_client_icebreakers_lead
  ON public.client_icebreakers (lead_id);

-- Important: Workspace-scoped deliveries query
CREATE INDEX IF NOT EXISTS idx_micro_deliveries_workspace
  ON public.micro_deliveries (workspace_id);

-- Important: Admin client search/filter (status only, plan is on profiles/workspaces)
CREATE INDEX IF NOT EXISTS idx_clients_status
  ON public.clients (status);

-- Important: FK index on client_icebreakers.workspace_id
CREATE INDEX IF NOT EXISTS idx_client_icebreakers_workspace
  ON public.client_icebreakers (workspace_id);
