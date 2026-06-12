"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";

// ─── UI state subset extracted from AppContext ────────────────────────
// Used by: Sidebar, TopBar, Toast, CommandPalette, ThemeToggle

export interface UIState {
  sidebarCollapsed: boolean;
  agentCollapsed: boolean;
  theme: "dark" | "light";
  toast: { message: string; type?: "info" | "error" | "success" } | null;
}

const initialUIState: UIState = {
  sidebarCollapsed: false,
  agentCollapsed: true,
  theme: "dark",
  toast: null,
};

export type UIAction =
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "TOGGLE_AGENT" }
  | { type: "SET_THEME"; payload: "dark" | "light" }
  | { type: "SET_TOAST"; payload: UIState["toast"] };

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "TOGGLE_AGENT":
      return { ...state, agentCollapsed: !state.agentCollapsed };
    case "SET_THEME":
      return { ...state, theme: action.payload };
    case "SET_TOAST":
      return { ...state, toast: action.payload };
    default:
      return state;
  }
}

const UIContext = createContext<{
  ui: UIState;
  dispatchUI: React.Dispatch<UIAction>;
}>({ ui: initialUIState, dispatchUI: () => {} });

export function UIProvider({ children }: { children: ReactNode }) {
  const [ui, dispatchUI] = useReducer(uiReducer, initialUIState);
  return (
    <UIContext.Provider value={{ ui, dispatchUI }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
