import { PanelLeft, RefreshCw } from "lucide-react";
import { useSystemStatus } from "../../contexts/SystemStatusContext";
import { ROUTE_TITLES, ROUTE_SUBTITLES, APP_NAME } from "../../utils/constants";

const STATUS_CLASS = {
  online: "status-chip--online",
  offline: "status-chip--offline",
  checking: "status-chip--checking",
  not_connected: "status-chip--not_connected",
  connected: "status-chip--connected",
  unknown: "status-chip--unknown",
};

const STATUS_LABEL = {
  online: "Online",
  offline: "Offline",
  checking: "Checking...",
  not_connected: "Not Connected",
  connected: "Connected",
  unknown: "Unknown",
};

function StatusChip({ label, status }) {
  const cls = STATUS_CLASS[status] || "status-chip--unknown";
  const text = STATUS_LABEL[status] || "Unknown";
  return (
    <div className={`status-chip ${cls}`}>
      <span className="status-chip__dot" />
      <span className="status-chip__label">{label}</span>
      <span className="status-chip__value">{text}</span>
    </div>
  );
}

export default function Header({ currentPath, onToggleSidebar, collapsed }) {
  const { backend, database, schedulingEngine, refresh } = useSystemStatus();
  const path = currentPath.split("?")[0].replace(/\/$/, "") || "/dashboard";
  const segment = path.split("/")[1] || "dashboard";
  const title = ROUTE_TITLES[segment] || APP_NAME;
  const subtitle = ROUTE_SUBTITLES[segment] || "";

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <button className="topbar__toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <PanelLeft size={18} />
        </button>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span className="brand-mark__rail" /><span className="brand-mark__bridge" /></div>
          <div className="brand-name">
            <span className="brand-name__hindi">रेल</span><span className="brand-name__english">Setu</span>
          </div>
          <div className="brand-tag">Operations control</div>
        </div>
      </div>

      <div className="topbar__title">
        <span className="topbar__title-main">{title}</span>
        {subtitle && <span className="topbar__title-sub">{subtitle}</span>}
      </div>

      <div className="topbar__right">
        <div className="topbar__status">
          <StatusChip label="Backend" status={backend} />
          <StatusChip label="Database" status={database} />
          <StatusChip label="Planner" status={schedulingEngine} />
        </div>
        <button className="topbar__refresh" onClick={refresh} aria-label="Refresh status">
          <RefreshCw size={14} />
        </button>
      </div>
    </header>
  );
}