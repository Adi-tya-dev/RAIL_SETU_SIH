import { useState } from "react";
import { RefreshCcw, Activity, ChevronDown, ChevronUp, X } from "lucide-react";
import { getLatestSync, runIntegrationSync } from "../../api/integration.api";
import { useApiQuery } from "../../hooks/useApi";
import { useToast } from "../../contexts/ToastContext";
import { SOURCE_NAMES, SOURCE_LABEL, SOURCE_TONE, statusTone } from "../../utils/constants";
import { formatDateTime } from "../../utils/formatters";
import Badge from "../common/Badge";

export default function SourceSyncBar({ onSynced, defaultMinimized = false }) {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [isHidden, setIsHidden] = useState(() => {
    try {
      return localStorage.getItem("railsetu_source_sync_hidden") === "true";
    } catch {
      return false;
    }
  });
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      const stored = localStorage.getItem("railsetu_source_sync_minimized");
      return stored !== null ? stored === "true" : defaultMinimized;
    } catch {
      return defaultMinimized;
    }
  });

  const { data, loading, reload } = useApiQuery(getLatestSync, []);

  const run = data?.data ?? null;
  const status = run && run.status !== "RUNNING" ? run.status : null;

  const toggleMinimize = (val) => {
    setIsMinimized(val);
    try {
      localStorage.setItem("railsetu_source_sync_minimized", String(val));
    } catch {}
  };

  const toggleHidden = (val) => {
    setIsHidden(val);
    try {
      localStorage.setItem("railsetu_source_sync_hidden", String(val));
    } catch {}
  };

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await runIntegrationSync();
      const runData = res?.data ?? {};
      const records = runData.summary
        ? Object.values(runData.summary).reduce(
            (acc, s) => acc + (s && (s.imported || 0)) + (s && (s.updated || 0)),
            0
          )
        : 0;
      const overall = runData.status || "COMPLETED";
      toast.success(
        overall === "FAILED"
          ? "Source sync finished with failures — check the run details."
          : `Source data synchronized: ${records} record(s) imported or updated.`
      );
      if (onSynced) onSynced();
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }

  // 1. Fully hidden state: renders a minimal unobtrusive restore chip
  if (isHidden) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => toggleHidden(false)}
          className="source-sync-toggle-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 10px",
            width: "auto",
            height: 26,
            borderRadius: 999,
          }}
          title="Restore Source Data Integration panel"
        >
          <Activity size={12} className="text-cyan" />
          <span>Show Source Integration</span>
          <ChevronDown size={12} />
        </button>
      </div>
    );
  }

  // 2. Minimized state: single sleek line with NO large blue button
  if (isMinimized) {
    return (
      <div
        className="source-sync-bar source-sync-bar--minimized"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          marginBottom: "var(--s4, 16px)",
          boxShadow: "var(--shadow-sm)",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1, minWidth: 0 }}
          onClick={() => toggleMinimize(false)}
          title="Click to expand source integration details"
        >
          <Activity size={14} className="text-cyan animate-pulse" style={{ color: "var(--blue, #38bdf8)", flexShrink: 0 }} />
          <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text)", whiteSpace: "nowrap" }}>
            SOURCE DATA INTEGRATION
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginLeft: 4 }}>
            {SOURCE_NAMES.map((code) => (
              <Badge key={code} tone={SOURCE_TONE[code]} style={{ fontSize: 10, padding: "1px 6px" }}>
                {code}
              </Badge>
            ))}
            {run && (
              <span className="cell-muted" style={{ fontSize: 11, marginLeft: 6 }}>
                Last sync: <strong style={{ color: "var(--text-2)" }}>{formatDateTime(run.completed_at || run.started_at)}</strong>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className="source-sync-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleSync();
            }}
            disabled={syncing}
            title={syncing ? "Syncing CRIS sources…" : "Run manual source sync"}
            aria-label="Run Sync"
          >
            <RefreshCcw size={13} className={syncing ? "animate-spin text-blue" : ""} />
          </button>

          <button
            type="button"
            className="source-sync-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize(false);
            }}
            title="Expand Source Data Integration"
            aria-label="Expand Source Data Integration"
          >
            <ChevronDown size={14} />
          </button>

          <button
            type="button"
            className="source-sync-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleHidden(true);
              toast.info("Source Integration bar hidden. Click the chip anytime to restore.");
            }}
            title="Hide this bar"
            aria-label="Hide bar"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  // 3. Expanded state: full card with subtle icon buttons instead of giant blue pill
  return (
    <Card
      title="Source Data Integration"
      subtitle="Railway source systems connected through adapters and simulators"
      actions={
        <Button
          variant="primary"
          size="sm"
          icon={RefreshCcw}
          loading={syncing}
          loadingText="Syncing…"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Syncing…" : "Run Sync"}
        </Button>
      }
    >
      <div className="pill-list" style={{ alignItems: "center" }}>
        {SOURCE_NAMES.map((code) => (
          <Badge key={code} tone={SOURCE_TONE[code]}>
            {code}
          </Badge>
        ))}
        <span className="cell-muted" style={{ marginLeft: 8 }}>
          {SOURCE_NAMES.map((code) => SOURCE_LABEL[code]).join(" · ")}
        </span>
      </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Badge tone="cyan">SIMULATOR</Badge>
          <span className="cell-muted">Simulated source data for prototype — not live railway data.</span>
          {loading ? (
            <span className="spinner spinner--xs" aria-hidden="true" />
          ) : run ? (
            <>
              <span className="cell-muted" style={{ marginLeft: 4 }}>Last sync:</span>
              <Badge tone={status ? statusTone(status) : "amber"} dot>
                {status || "RUNNING"}
              </Badge>
              <span className="cell-muted">{formatDateTime(run.completed_at || run.started_at)}</span>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--blue, #38bdf8)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  marginLeft: 6,
                }}
              >
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              style={{
                background: "none",
                border: "none",
                color: "var(--blue, #38bdf8)",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                marginLeft: 4,
              }}
            >
              {syncing ? "Syncing…" : "Run initial sync"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}