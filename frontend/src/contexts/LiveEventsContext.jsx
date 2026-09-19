import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { openEventStream } from "../api/events.api";
import { useToast } from "./ToastContext";

const LiveEventsContext = createContext(null);

const SOURCE_LABEL = { TMS: "TMS · Engineering", SMMS: "SMMS · Signalling", TDMS: "TDMS · Traction" };
const DEPT_EMOJI   = { ENGINEERING: "🔧", SIGNAL: "📡", TRACTION: "⚡" };

export function LiveEventsProvider({ children }) {
  const { pushToast } = useToast();

  // Connection state
  const [liveStatus, setLiveStatus] = useState("connecting"); // "connecting" | "live" | "error"

  // How many new requests have arrived since the page loaded
  const [newRequestCount, setNewRequestCount] = useState(0);

  // Whether the active plan was just auto-updated (cleared when consumer calls clearPlanUpdated)
  const [planUpdated, setPlanUpdated] = useState(null); // null | { task, plan_id, pipeline_summary }

  // Keep track of recently-received request ids to avoid duplicate toasts
  const seenRefs = useRef(new Set());

  const clearPlanUpdated = useCallback(() => setPlanUpdated(null), []);

  useEffect(() => {
    const closeStream = openEventStream({
      onConnected: () => {
        setLiveStatus("live");
      },

      onNewRequest: (data) => {
        const ref = data?.task?.external_ref;
        if (ref && seenRefs.current.has(ref)) return;
        if (ref) seenRefs.current.add(ref);

        setNewRequestCount((n) => n + 1);

        const source  = data?.source || "UNKNOWN";
        const dept    = data?.task?.department || "";
        const type    = data?.task?.maintenance_type?.replace(/_/g, " ") || "Maintenance request";
        const emoji   = DEPT_EMOJI[dept] || "📋";
        const srcLabel = SOURCE_LABEL[source] || source;

        pushToast({
          type:    "info",
          message: `${emoji} New request from ${srcLabel} — ${type}`,
        });
      },

      onPlanUpdated: (data) => {
        setPlanUpdated(data);
        const src  = data?.source || "source system";
        const eff  = data?.pipeline_summary?.efficiency
          ? ` · Efficiency ${data.pipeline_summary.efficiency}`
          : "";
        pushToast({
          type:    "success",
          message: `⚡ Plan auto-updated — new request from ${src} affected active blocks${eff}`,
        });
      },

      onHeartbeat: () => {
        // Keep-alive — just ensure status is live
        setLiveStatus("live");
      },

      onError: () => {
        setLiveStatus("error");
      },
    });

    return closeStream;
  }, [pushToast]);

  const value = { liveStatus, newRequestCount, planUpdated, clearPlanUpdated };

  return (
    <LiveEventsContext.Provider value={value}>
      {children}
    </LiveEventsContext.Provider>
  );
}

export function useLiveEvents() {
  const ctx = useContext(LiveEventsContext);
  if (!ctx) throw new Error("useLiveEvents must be used within LiveEventsProvider");
  return ctx;
}
