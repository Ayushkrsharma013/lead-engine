"use client";

import React, { createContext, useContext, useReducer, useEffect, type Dispatch } from "react";
import { supabase } from "./supabase";
import type { Client } from "./types";

interface PortalAuthState {
  client: Client | null;
  loading: boolean;
  error: string | null;
}

type PortalAction =
  | { type: "LOGIN"; payload: Client }
  | { type: "LOGOUT" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null };

const PortalContext = createContext<{
  state: PortalAuthState;
  dispatch: Dispatch<PortalAction>;
  login: (company: string, password: string) => Promise<boolean>;
  logout: () => void;
} | null>(null);

function reducer(s: PortalAuthState, a: PortalAction): PortalAuthState {
  switch (a.type) {
    case "LOGIN": return { client: a.payload, loading: false, error: null };
    case "LOGOUT": return { client: null, loading: false, error: null };
    case "SET_LOADING": return { ...s, loading: a.payload };
    case "SET_ERROR": return { ...s, error: a.payload, loading: false };
    default: return s;
  }
}

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { client: null, loading: true, error: null });

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("proos_portal_client");
      if (stored) {
        const client = JSON.parse(stored) as Client;
        dispatch({ type: "LOGIN", payload: client });
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const login = async (company: string, password: string): Promise<boolean> => {
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Verify portal password via bcrypt-hashed RPC (SECURITY DEFINER)
      // This avoids sending passwords in plaintext Supabase query filters
      // and prevents timing attacks via constant-time bcrypt comparison
      const { data, error } = await supabase
        .rpc("verify_portal_password", {
          p_company: company,
          p_password: password
        })
        .single();

      if (error || !data) {
        dispatch({ type: "SET_ERROR", payload: "Invalid company name or password." });
        return false;
      }

      const client = clientFromDBPortal(data as Record<string, unknown>);
      localStorage.setItem("proos_portal_client", JSON.stringify(client));
      dispatch({ type: "LOGIN", payload: client });
      return true;
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Login failed. Please try again." });
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("proos_portal_client");
    dispatch({ type: "LOGOUT" });
  };

  return (
    <PortalContext.Provider value={{ state, dispatch, login, logout }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return ctx;
}

// Import from db helpers
function clientFromDBPortal(row: Record<string, unknown>): Client {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    company: String(row.company || ""),
    industry: String(row.industry || ""),
    monthlyRetainer: Number(row.monthly_retainer || 0),
    status: String(row.status || "active") as "active" | "inactive",
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}
