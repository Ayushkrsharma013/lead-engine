// lib/agents/outreach-agent.ts
import type { AgentModule, AgentResult } from "./types";

export class OutreachAgent implements AgentModule {
  name = "outreach-agent";
  displayName = "Outreach Agent";
  description = "Sequence execution, email sends, reply handling";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "Outreach Agent not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
