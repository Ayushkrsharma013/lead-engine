-- Allow agent_actions.status = 'failed' for dispatch errors

ALTER TABLE agent_actions
  DROP CONSTRAINT IF EXISTS agent_actions_status_check;

ALTER TABLE agent_actions
  ADD CONSTRAINT agent_actions_status_check
  CHECK (status IN ('pending','approved','rejected','executed','notified','failed'));
