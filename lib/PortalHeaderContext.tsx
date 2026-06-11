"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface PortalHeaderConfig {
  title: string;
  description?: string;
  actions?: ReactNode;
}

interface PortalHeaderContextType {
  config: PortalHeaderConfig;
  setConfig: (c: PortalHeaderConfig) => void;
}

const defaultConfig: PortalHeaderConfig = { title: "Client Portal" };

const PortalHeaderCtx = createContext<PortalHeaderContextType>({
  config: defaultConfig,
  setConfig: () => {},
});

export function PortalHeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PortalHeaderConfig>(defaultConfig);
  return (
    <PortalHeaderCtx.Provider value={{ config, setConfig }}>
      {children}
    </PortalHeaderCtx.Provider>
  );
}

export function usePortalHeader(config?: PortalHeaderConfig) {
  const ctx = useContext(PortalHeaderCtx);
  if (config) ctx.setConfig(config);
  return ctx;
}
