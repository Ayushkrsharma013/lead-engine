"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback, type Dispatch } from "react";
import { supabase } from "./supabase";
import {
  fetchLeadsFromDB, mergeLeadsInDB, deleteLeadsFromDB, computeStatsFromLeads,
  getMessages, getSequences, getCampaigns, getClients, getActivityLog,
} from "./db";
import { seedIfEmpty } from "./seed";
import type {
  Lead, Message, Sequence, Campaign, Client, ActivityLogEntry,
  FilterState, SortState, PaginationState, Source, Stats, LogEntry,
  ModuleName, Notification,
} from "./types";
import { DEFAULT_FILTERS, DEFAULT_SORT, DEFAULT_PAGINATION } from "./types";

// ─── State ──────────────────────────────────────────────────────────────────────

export interface EnabledSources {
  linkedin: boolean;
  gmaps: boolean;
  amazon: boolean;
}

export interface AppState {
  // Data
  leads: Lead[];
  latestLeads: Lead[];
  messages: Message[];
  sequences: Sequence[];
  campaigns: Campaign[];
  clients: Client[];
  activityLog: ActivityLogEntry[];

  // API key (in-memory only)
  apiKey: string;

  // UI
  theme: "dark" | "light";
  sidebarCollapsed: boolean;
  activeModule: ModuleName;
  settingsOpen: boolean;

  // Source gating
  enabledSources: EnabledSources;

  // Lead table state
  selected: string[];
  filters: FilterState;
  sort: SortState;
  pagination: PaginationState;
  tab: "all" | "latest";
  source: Source;

  // Agent
  mock: boolean;
  running: boolean;
  log: LogEntry[];
  progress: number;

  // Misc
  toast: { msg: string; type: "success" | "warn" | "error" } | null;
  stats: Stats;
  loading: boolean;
  notifications: Notification[];
}

const DEFAULT_ENABLED_SOURCES: EnabledSources = {
  linkedin: true,
  gmaps: false,
  amazon: false,
};

const initialState: AppState = {
  leads: [],
  latestLeads: [],
  messages: [],
  sequences: [],
  campaigns: [],
  clients: [],
  activityLog: [],
  apiKey: "",
  theme: "dark",
  sidebarCollapsed: false,
  activeModule: "leads",
  settingsOpen: false,
  enabledSources: DEFAULT_ENABLED_SOURCES,
  selected: [],
  filters: DEFAULT_FILTERS,
  sort: DEFAULT_SORT,
  pagination: DEFAULT_PAGINATION,
  tab: "all",
  source: "linkedin",
  mock: false,
  running: false,
  log: [],
  progress: 0,
  toast: null,
  stats: { total: 0, withEmail: 0, avgScore: 0, topIndustry: "—" },
  loading: true,
  notifications: [],
};

function initFromStorage(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const theme = localStorage.getItem("leados_theme");
    const sidebar = localStorage.getItem("leados_sidebar");
    const sourcesRaw = localStorage.getItem("leados_sources");
    let enabledSources = DEFAULT_ENABLED_SOURCES;
    if (sourcesRaw) {
      try { enabledSources = { ...DEFAULT_ENABLED_SOURCES, ...JSON.parse(sourcesRaw) }; } catch { /* ignore */ }
    }
    return {
      ...initialState,
      theme: theme === "light" ? "light" : "dark",
      sidebarCollapsed: sidebar === "closed",
      enabledSources,
    };
  } catch {
    return initialState;
  }
}

// ─── Actions ────────────────────────────────────────────────────────────────────

export type AppAction =
  | { type: "SET_API_KEY"; payload: string }
  | { type: "SET_THEME"; payload: "dark" | "light" }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_MODULE"; payload: ModuleName }
  | { type: "SET_LOADING"; payload: boolean }
  // Leads
  | { type: "SET_LEADS"; payload: Lead[] }
  | { type: "MERGE_LEADS"; payload: { stored: Lead[]; incoming: Lead[]; added: number; updated: number } }
  | { type: "DELETE_LEADS"; payload: { stored: Lead[]; deletedIds: string[] } }
  | { type: "SET_LEAD_SELECTION"; payload: string[] }
  | { type: "TOGGLE_LEAD_SELECTION"; payload: string }
  | { type: "SELECT_ALL_LEADS"; payload: string[] }
  // Filters / Sort / Pagination
  | { type: "SET_FILTERS"; payload: FilterState }
  | { type: "SET_SORT"; payload: SortState }
  | { type: "SET_PAGINATION"; payload: PaginationState }
  | { type: "SET_TAB"; payload: "all" | "latest" }
  | { type: "SET_SOURCE"; payload: Source }
  | { type: "SET_MOCK"; payload: boolean }
  // Agent
  | { type: "SET_RUNNING"; payload: boolean }
  | { type: "SET_PROGRESS"; payload: number }
  | { type: "APPEND_LOG"; payload: LogEntry }
  | { type: "CLEAR_LOG" }
  // Toast
  | { type: "SET_TOAST"; payload: AppState["toast"] }
  // Stats
  | { type: "SET_STATS"; payload: Stats }
  // Other data
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_SEQUENCES"; payload: Sequence[] }
  | { type: "SAVE_SEQUENCE"; payload: Sequence }
  | { type: "DELETE_SEQUENCE"; payload: string }
  | { type: "SET_CAMPAIGNS"; payload: Campaign[] }
  | { type: "SAVE_CAMPAIGN"; payload: Campaign }
  | { type: "SET_CLIENTS"; payload: Client[] }
  | { type: "SAVE_CLIENT"; payload: Client }
  | { type: "SET_ACTIVITY_LOG"; payload: ActivityLogEntry[] }
  | { type: "ADD_NOTIFICATION"; payload: Notification }
  | { type: "MARK_ALL_READ" }
  | { type: "TOGGLE_SETTINGS" }
  | { type: "SET_SETTINGS_OPEN"; payload: boolean }
  | { type: "SET_ENABLED_SOURCES"; payload: EnabledSources };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_API_KEY":
      return { ...state, apiKey: action.payload };
    case "SET_THEME":
      return { ...state, theme: action.payload };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "SET_MODULE":
      return { ...state, activeModule: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "TOGGLE_SETTINGS":
      return { ...state, settingsOpen: !state.settingsOpen };
    case "SET_SETTINGS_OPEN":
      return { ...state, settingsOpen: action.payload };
    case "SET_ENABLED_SOURCES":
      return { ...state, enabledSources: action.payload };

    case "SET_LEADS":
      return {
        ...state,
        leads: action.payload,
        latestLeads: state.tab === "latest" ? state.latestLeads : state.latestLeads,
        selected: state.selected.filter(id => action.payload.some(l => l.id === id)),
      };
    case "MERGE_LEADS":
      return {
        ...state,
        leads: action.payload.stored,
        latestLeads: action.payload.incoming,
        tab: "latest",
        selected: state.selected.filter(id => action.payload.stored.some(l => l.id === id)),
      };
    case "DELETE_LEADS": {
      const deleted = new Set(action.payload.deletedIds);
      return {
        ...state,
        leads: action.payload.stored,
        latestLeads: state.latestLeads.filter(l => !deleted.has(l.id)),
        selected: state.selected.filter(id => !deleted.has(id)),
      };
    }
    case "SET_LEAD_SELECTION":
      return { ...state, selected: action.payload };
    case "TOGGLE_LEAD_SELECTION": {
      const id = action.payload;
      return {
        ...state,
        selected: state.selected.includes(id)
          ? state.selected.filter(s => s !== id)
          : [...state.selected, id],
      };
    }
    case "SELECT_ALL_LEADS":
      return { ...state, selected: action.payload };

    case "SET_FILTERS":
      return { ...state, filters: action.payload, pagination: { ...state.pagination, page: 1 } };
    case "SET_SORT":
      return { ...state, sort: action.payload, pagination: { ...state.pagination, page: 1 } };
    case "SET_PAGINATION":
      return { ...state, pagination: action.payload };
    case "SET_TAB":
      return { ...state, tab: action.payload };
    case "SET_SOURCE":
      return { ...state, source: action.payload };
    case "SET_MOCK":
      return { ...state, mock: action.payload };

    case "SET_RUNNING":
      return { ...state, running: action.payload };
    case "SET_PROGRESS":
      return { ...state, progress: action.payload };
    case "APPEND_LOG":
      return { ...state, log: [...state.log, action.payload] };
    case "CLEAR_LOG":
      return { ...state, log: [] };

    case "SET_TOAST":
      return { ...state, toast: action.payload };
    case "SET_STATS":
      return { ...state, stats: action.payload };

    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [action.payload, ...state.messages] };
    case "SET_SEQUENCES":
      return { ...state, sequences: action.payload };
    case "SAVE_SEQUENCE": {
      const idx = state.sequences.findIndex(s => s.id === action.payload.id);
      if (idx >= 0) {
        const seqs = [...state.sequences];
        seqs[idx] = action.payload;
        return { ...state, sequences: seqs };
      }
      return { ...state, sequences: [action.payload, ...state.sequences] };
    }
    case "DELETE_SEQUENCE":
      return { ...state, sequences: state.sequences.filter(s => s.id !== action.payload) };
    case "SET_CAMPAIGNS":
      return { ...state, campaigns: action.payload };
    case "SAVE_CAMPAIGN": {
      const idx = state.campaigns.findIndex(c => c.id === action.payload.id);
      if (idx >= 0) {
        const camps = [...state.campaigns];
        camps[idx] = action.payload;
        return { ...state, campaigns: camps };
      }
      return { ...state, campaigns: [action.payload, ...state.campaigns] };
    }
    case "SET_CLIENTS":
      return { ...state, clients: action.payload };
    case "SAVE_CLIENT": {
      const idx = state.clients.findIndex(c => c.id === action.payload.id);
      if (idx >= 0) {
        const clients = [...state.clients];
        clients[idx] = action.payload;
        return { ...state, clients: clients };
      }
      return { ...state, clients: [action.payload, ...state.clients] };
    }
    case "SET_ACTIVITY_LOG":
      return { ...state, activityLog: action.payload };
    case "ADD_NOTIFICATION":
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case "MARK_ALL_READ":
      return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────────

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<AppAction> } | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, initFromStorage);

  // Persist theme, sidebar, and source settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("leados_theme", state.theme);
      localStorage.setItem("leados_sidebar", state.sidebarCollapsed ? "closed" : "open");
      localStorage.setItem("leados_sources", JSON.stringify(state.enabledSources));
    } catch { /* ignore */ }
  }, [state.theme, state.sidebarCollapsed, state.enabledSources]);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme);
  }, [state.theme]);

  // Load leads from Supabase on mount + subscribe to real-time changes
  useEffect(() => {
    async function init() {
      try {
        await seedIfEmpty();
        const leads = await fetchLeadsFromDB();
        dispatch({ type: "SET_LEADS", payload: leads });
        const stats = await computeStatsFromLeads(leads);
        dispatch({ type: "SET_STATS", payload: stats });

        // Load all supporting data in parallel
        const [messages, sequences, campaigns, clients, activityLog] = await Promise.all([
          getMessages().catch(() => [] as Message[]),
          getSequences().catch(() => [] as Sequence[]),
          getCampaigns().catch(() => [] as Campaign[]),
          getClients().catch(() => [] as Client[]),
          getActivityLog(50).catch(() => [] as ActivityLogEntry[]),
        ]);
        dispatch({ type: "SET_MESSAGES", payload: messages });
        dispatch({ type: "SET_SEQUENCES", payload: sequences });
        dispatch({ type: "SET_CAMPAIGNS", payload: campaigns });
        dispatch({ type: "SET_CLIENTS", payload: clients });
        dispatch({ type: "SET_ACTIVITY_LOG", payload: activityLog });
      } catch (e) {
        console.error("Failed to load from Supabase:", e);
      }
      dispatch({ type: "SET_LOADING", payload: false });
    }
    init();

    const channel = supabase
      .channel("leads_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchLeadsFromDB()
          .then(leads => {
            dispatch({ type: "SET_LEADS", payload: leads });
            return computeStatsFromLeads(leads);
          })
          .then(stats => dispatch({ type: "SET_STATS", payload: stats }))
          .catch((e) => { console.error("Realtime leads fetch failed:", e); });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}
