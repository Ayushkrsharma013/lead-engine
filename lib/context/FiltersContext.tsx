"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { FilterState, SortState, PaginationState, Source } from "@/lib/types";

// ─── Filter/sort/pagination state extracted from AppContext ───────────

export interface FiltersState {
  filters: FilterState;
  sortState: SortState;
  pagination: PaginationState;
  source: Source;
}

const initialFiltersState: FiltersState = {
  filters: {} as FilterState,
  sortState: { field: "score", dir: "desc" },
  pagination: { page: 1, pageSize: 25 },
  source: "linkedin",
};

export type FiltersAction =
  | { type: "SET_FILTERS"; payload: FilterState }
  | { type: "SET_SORT"; payload: SortState }
  | { type: "SET_PAGINATION"; payload: PaginationState }
  | { type: "SET_SOURCE"; payload: Source };

function filtersReducer(state: FiltersState, action: FiltersAction): FiltersState {
  switch (action.type) {
    case "SET_FILTERS":
      return { ...state, filters: action.payload };
    case "SET_SORT":
      return { ...state, sortState: action.payload };
    case "SET_PAGINATION":
      return { ...state, pagination: action.payload };
    case "SET_SOURCE":
      return { ...state, source: action.payload };
    default:
      return state;
  }
}

const FiltersContext = createContext<{
  filters: FiltersState;
  dispatchFilters: React.Dispatch<FiltersAction>;
}>({ filters: initialFiltersState, dispatchFilters: () => {} });

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, dispatchFilters] = useReducer(filtersReducer, initialFiltersState);
  return (
    <FiltersContext.Provider value={{ filters, dispatchFilters }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  return useContext(FiltersContext);
}
