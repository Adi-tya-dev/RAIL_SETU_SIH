import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getHealth, getDatabaseHealth } from "../api/health.api";

const SystemStatusContext = createContext(null);

export function SystemStatusProvider({ children }) {
  const [status, setStatus] = useState({
    backend: "checking",
    database: "unknown",
    schedulingEngine: "not_connected",
  });

  const check = useCallback(async () => {
    setStatus((s) => ({ ...s, backend: "checking" }));

    try {
      await getHealth();
      setStatus((s) => ({ ...s, backend: "online" }));
    } catch {
      setStatus((s) => ({ ...s, backend: "offline", database: "unknown" }));
      return;
    }

    try {
      await getDatabaseHealth();
      setStatus((s) => ({ ...s, database: "online" }));
    } catch {
      setStatus((s) => ({ ...s, database: "offline" }));
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const markSchedulingEngine = useCallback((connected) => {
    setStatus((s) => ({
      ...s,
      schedulingEngine: connected ? "connected" : "not_connected",
    }));
  }, []);

  const value = useMemo(
    () => ({ ...status, refresh: check, markSchedulingEngine }),
    [status, check, markSchedulingEngine]
  );

  return <SystemStatusContext.Provider value={value}>{children}</SystemStatusContext.Provider>;
}

export function useSystemStatus() {
  const ctx = useContext(SystemStatusContext);
  if (!ctx) throw new Error("useSystemStatus must be used within a SystemStatusProvider");
  return ctx;
}