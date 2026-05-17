// lib/agents/message-coach.ts
import type { AgentModule, AgentResult } from "./types";

export class MessageCoachAgent implements AgentModule {
  name = "message-coach";
  displayName = "Message Coach";
  description = "A/B winner detection and message refinement";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "Message Coach not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
