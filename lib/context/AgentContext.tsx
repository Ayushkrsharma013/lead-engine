"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";

// ─── Agent system state extracted from AppContext ─────────────────────

export interface AgentContextState {
  agentState: Record<string, unknown>;
  isRunning: boolean;
  progress: number;
  log: string[];
  activityLog: Array<{ id: string; action: string; timestamp: string }>;
  mockMode: boolean;
}

const initialAgentState: AgentContextState = {
  agentState: {},
  isRunning: false,
  progress: 0,
  log: [],
  activityLog: [],
  mockMode: false,
};

export type AgentAction =
  | { type: "SET_AGENT_STATE"; payload: Record<string, unknown> }
  | { type: "SET_RUNNING"; payload: boolean }
  | { type: "SET_PROGRESS"; payload: number }
  | { type: "APPEND_LOG"; payload: string }
  | { type: "CLEAR_LOG" }
  | { type: "SET_ACTIVITY_LOG"; payload: AgentContextState["activityLog"] }
  | { type: "SET_MOCK_MODE"; payload: boolean };

function agentReducer(state: AgentContextState, action: AgentAction): AgentContextState {
  switch (action.type) {
    case "SET_AGENT_STATE":
      return { ...state, agentState: action.payload };
    case "SET_RUNNING":
      return { ...state, isRunning: action.payload };
    case "SET_PROGRESS":
      return { ...state, progress: action.payload };
    case "APPEND_LOG":
      return { ...state, log: [...state.log, action.payload] };
    case "CLEAR_LOG":
      return { ...state, log: [] };
    case "SET_ACTIVITY_LOG":
      return { ...state, activityLog: action.payload };
    case "SET_MOCK_MODE":
      return { ...state, mockMode: action.payload };
    default:
      return state;
  }
}

const AgentContext = createContext<{
  agent: AgentContextState;
  dispatchAgent: React.Dispatch<AgentAction>;
}>({ agent: initialAgentState, dispatchAgent: () => {} });

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agent, dispatchAgent] = useReducer(agentReducer, initialAgentState);
  return (
    <AgentContext.Provider value={{ agent, dispatchAgent }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgents() {
  return useContext(AgentContext);
}
