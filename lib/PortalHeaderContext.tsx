"use client";

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";

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
  const prevRef = useRef<string>("");

  useEffect(() => {
    if (!config) return;
    // Only update if title/description/actions actually changed
    const key = JSON.stringify({ title: config.title, description: config.description, hasActions: !!config.actions });
    if (key !== prevRef.current) {
      prevRef.current = key;
      ctx.setConfig(config);
    }
  }, [config?.title, config?.description, config?.actions]);

  return ctx;
}
