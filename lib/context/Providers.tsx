"use client";

import type { ReactNode } from "react";
import { UIProvider } from "./UIContext";
import { FiltersProvider } from "./FiltersContext";
import { AgentProvider } from "./AgentContext";

/**
 * Client-component wrapper that composes all split contexts.
 * Wraps around the existing AppProvider for backward compatibility.
 *
 * Migration path: Components can gradually switch from useApp()
 * to useUI() / useFilters() / useAgents() to reduce re-renders.
 */
export function ContextProviders({ children }: { children: ReactNode }) {
  return (
    <UIProvider>
      <FiltersProvider>
        <AgentProvider>
          {children}
        </AgentProvider>
      </FiltersProvider>
    </UIProvider>
  );
}
