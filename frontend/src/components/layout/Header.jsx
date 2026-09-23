import { PanelLeft, RefreshCw } from "lucide-react";
import { useSystemStatus } from "../../contexts/SystemStatusContext";
import { useLiveEvents } from "../../contexts/LiveEventsContext";
import { ROUTE_TITLES, ROUTE_SUBTITLES, APP_NAME } from "../../utils/constants";

const STATUS_CLASS = {
  online:        "status-chip--online",
  offline:       "status-chip--offline",
  checking:      "status-chip--checking",
  not_connected: "status-chip--not_connected",
  connected:     "status-chip--connected",
  unknown:       "status-chip--unknown",
};

const STATUS_LABEL = {
  online:        "Online",
  offline:       "Offline",
  checking:      "Checking...",
  not_connected: "Not Connected",
  connected:     "Connected",
  unknown:       "Unknown",
};

function StatusChip({ label, status }) {
  const cls  = STATUS_CLASS[status] || "status-chip--unknown";
  const text = STATUS_LABEL[status] || "Unknown";
  return (
    <div className={`status-chip ${cls}`}>
      <span className="status-chip__dot" />
      <span className="status-chip__label">{label}</span>
      <span className="status-chip__value">{text}</span>
    </div>
  );
}

/** Small animated "● LIVE" indicator showing SSE connection state */
function LiveIndicator({ status, newCount }) {
  const isLive  = status === "live";
  const isError = status === "error";

  const dotStyle = {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: isLive ? "#22c55e" : isError ? "#ef4444" : "var(--text-muted, #888)",
    boxShadow: isLive ? "0 0 8px #22c55e" : "none",
    animation: isLive ? "livePulse 2s ease-in-out infinite" : "none",
    flexShrink: 0,
  };

  const wrapStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    border: `1px solid ${isLive ? "rgba(34,197,94,0.4)" : isError ? "rgba(239,68,68,0.4)" : "var(--border, rgba(255,255,255,0.1))"}`,
    background: isLive ? "rgba(34,197,94,0.12)" : isError ? "rgba(239,68,68,0.12)" : "transparent",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.03em",
    color: isLive ? "#4ade80" : isError ? "#f87171" : "var(--text-muted, #888)",
    whiteSpace: "nowrap",
    userSelect: "none",
    cursor: "default",
  };

  const label = isLive ? "LIVE" : isError ? "Disconnected" : "Connecting…";

  return (
    <div
      style={wrapStyle}
      title={
        isLive
          ? `Real-time simulator feed active${newCount ? ` · ${newCount} new request${newCount > 1 ? "s" : ""} received` : ""}`
          : isError
          ? "SSE stream disconnected — live updates paused"
          : "Connecting to live stream…"
      }
    >
      <span style={dotStyle} />
      <span>{label}</span>
      {isLive && newCount > 0 && (
        <span
          style={{
            background: "rgba(34,197,94,0.25)",
            border: "1px solid rgba(34,197,94,0.5)",
            color: "#4ade80",
            borderRadius: 999,
            padding: "1px 6px",
            fontSize: 11,
            fontWeight: 800,
            lineHeight: "14px",
            minWidth: 16,
            textAlign: "center",
          }}
        >
          +{newCount > 99 ? "99+" : newCount}
        </span>
      )}
    </div>
  );
}

export default function Header({ currentPath, onToggleSidebar, collapsed }) {
  const { backend, database, refresh } = useSystemStatus();
  const { liveStatus, newRequestCount } = useLiveEvents();

  const path     = currentPath.split("?")[0].replace(/\/$/, "") || "/dashboard";
  const segment  = path.split("/")[1] || "dashboard";
  const title    = ROUTE_TITLES[segment]    || APP_NAME;
  const subtitle = ROUTE_SUBTITLES[segment] || "";

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <button className="topbar__toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <PanelLeft size={18} />
        </button>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-mark__rail" />
            <span className="brand-mark__bridge" />
          </div>
          <div className="brand-text">
            <div className="brand-name">
              <span className="brand-name__hindi">रेल</span><span className="brand-name__english">Setu</span>
            </div>
            <div className="brand-tag">Operations control</div>
          </div>
        </div>
      </div>

      <div className="topbar__title">
        <span className="topbar__title-main">{title}</span>
        {subtitle && <span className="topbar__title-sub">{subtitle}</span>}
      </div>

      <div className="topbar__right">
        {/* Live SSE status indicator */}
        <LiveIndicator status={liveStatus} newCount={newRequestCount} />

        <div className="topbar__status">
          <StatusChip label="Backend"  status={backend} />
          <StatusChip label="Database" status={database} />
        </div>

        <button className="topbar__refresh" onClick={refresh} aria-label="Refresh status" title="Refresh status">
          <RefreshCw size={14} />
        </button>
      </div>
    </header>
  );
}