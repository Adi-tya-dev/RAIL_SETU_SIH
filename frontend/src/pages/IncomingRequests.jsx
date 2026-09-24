import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wrench, Signal, Zap, Inbox, Radio, AlertTriangle, X } from "lucide-react";
import { listIncomingRequests } from "../api/integration.api";
import { injectSimulatorRequest } from "../api/events.api";
import { useApiQuery } from "../hooks/useApi";
import { useLiveEvents } from "../contexts/LiveEventsContext";
import {
  SOURCE_NAMES,
  SOURCE_TONE,
  MAINTENANCE_STATUSES,
  LEVELS,
  PRIORITY_TONE,
  statusTone,
} from "../utils/constants";
import {
  formatDateTime,
  formatDuration,
  humanize,
  formatRelativeTime,
  toDateTimeLocalValue,
  getDeadlineCompliance,
} from "../utils/formatters";
import PageHeader from "../components/common/PageHeader";
import KpiCard from "../components/common/KpiCard";
import Filters, { FilterField } from "../components/common/Filters";
import DataTable from "../components/common/DataTable";
import Pagination from "../components/common/Pagination";
import StateBlock from "../components/common/StateBlock";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import SourceSyncBar from "../components/integration/SourceSyncBar";
import RequestLifecycleDrawer from "../components/integration/RequestLifecycleDrawer";
import { getTaskWorkPackage } from "../utils/workPackageHelper";

const EMPTY_FILTERS = { source: "", status: "", urgency: "", criticality: "" };

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

function pcuBadge(value, toneSource) {
  return <Badge tone={toneSource[value]}>{value}</Badge>;
}

// ── Plan-updated banner ──────────────────────────────────────────────────────
function PlanUpdatedBanner({ data, onDismiss }) {
  if (!data) return null;
  const src  = data.source || "a source system";
  const eff  = data.pipeline_summary?.efficiency
    ? ` · Efficiency ${data.pipeline_summary.efficiency}`
    : "";
  const pkg  = data.pipeline_summary?.packages;
  const asgn = data.pipeline_summary?.assigned;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 18px",
        marginBottom: "var(--s4, 16px)",
        borderRadius: 10,
        border: "1px solid rgba(34,197,94,0.35)",
        background: "rgba(34,197,94,0.09)",
        fontSize: 13,
      }}
    >
      <AlertTriangle size={16} style={{ color: "#4ade80", flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <strong style={{ color: "#4ade80" }}>Block plan automatically updated</strong>
        <p style={{ margin: "4px 0 0", color: "var(--text-secondary, #aaa)", fontSize: 12 }}>
          A new maintenance request from <strong>{src}</strong> targets blocks in the current active plan.
          The planning algorithm re-ran automatically.
          {pkg !== undefined && (
            <> Work packages: <strong>{asgn}/{pkg}</strong> assigned{eff}.</>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #888)", padding: 2 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}

// ── Inject test request panel ────────────────────────────────────────────────
function InjectPanel({ onInjected }) {
  const [open,      setOpen]      = useState(false);
  const [source,    setSource]    = useState("TMS");
  const [ref,       setRef]       = useState("");
  const [block,     setBlock]     = useState("B001");
  const [maintType, setMaintType] = useState("TRACK_REALIGNMENT");
  const [status,    setStatus]    = useState("PENDING");
  const [prefStart, setPrefStart] = useState(() => toDateTimeLocalValue(new Date(Date.now() + 2 * 3600 * 1000)));
  const [deadline,  setDeadline]  = useState(() => toDateTimeLocalValue(new Date(Date.now() + 6 * 3600 * 1000)));
  const [busy,      setBusy]      = useState(false);
  const [result,    setResult]    = useState(null);
  const idRef = useRef(0);

  function generateRef() {
    idRef.current += 1;
    return `${source}-INJECT-${Date.now().toString(36).toUpperCase()}-${idRef.current}`;
  }

  async function handleInject() {
    const reqRef = ref.trim() || generateRef();
    setBusy(true);
    setResult(null);
    try {
      const pStart = prefStart ? new Date(prefStart).toISOString() : new Date(Date.now() + 2 * 3600 * 1000).toISOString();
      const dLine  = deadline  ? new Date(deadline).toISOString()  : new Date(Date.now() + 6 * 3600 * 1000).toISOString();

      const res = await injectSimulatorRequest(source, {
        request_id:       reqRef,
        maintenance_type: maintType,
        description:      `Injected live request — ${reqRef} on block ${block}`,
        priority:         status === "COMPLETED" ? 2 : 3,
        criticality:      3,
        urgency:          status === "IN_PROGRESS" ? 4 : 2,
        duration_minutes: 90,
        block_code:       block.trim() || null,
        preferred_start:  pStart,
        deadline:         dLine,
        status:           status,
      });
      setResult({ ok: true, message: res.message || "Injected into simulator catalog! The watcher will detect it within 5 seconds." });
      setRef("");
      onInjected?.();
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="simulator-inject-trigger"
        title="Inject a custom request to test live real-time ingestion, preferred start, and deadline tracking"
      >
        <Radio size={14} /> + Inject Simulator Request (Test Pub/Sub)
      </button>
    );
  }

  return (
    <div className="simulator-inject-card">
      <div className="simulator-inject-header">
        <Radio size={16} color="#0284c7" />
        <strong className="simulator-inject-title">Simulate New Portal Request (TMS · SMMS · TDMS)</strong>
        <span className="simulator-inject-badge">
          Polls every 5s
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="simulator-inject-close"
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>

      <div className="simulator-inject-grid">
        <div className="simulator-inject-field">
          <label className="simulator-inject-label">Source System</label>
          <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="TMS">TMS · Track / Engineering</option>
            <option value="SMMS">SMMS · Signal & Telecom</option>
            <option value="TDMS">TDMS · Traction / Electrical</option>
          </select>
        </div>

        <div className="simulator-inject-field">
          <label className="simulator-inject-label">Target Block</label>
          <input className="input" value={block} onChange={(e) => setBlock(e.target.value)} placeholder="e.g. B001, B012" />
        </div>

        <div className="simulator-inject-field">
          <label className="simulator-inject-label">Maintenance Type</label>
          <select className="select" value={maintType} onChange={(e) => setMaintType(e.target.value)}>
            <option value="TRACK_REALIGNMENT">Track Realignment</option>
            <option value="RAIL_CRACK">Rail Crack Rectification</option>
            <option value="SIGNAL_POWER">Signal Power Feed Fault</option>
            <option value="INTERLOCKING">Relay Interlocking Overhaul</option>
            <option value="OHE_DROPPER">OHE Dropper Wire Repair</option>
            <option value="TRANSFORMER">Transformer Oil Service</option>
          </select>
        </div>

        <div className="simulator-inject-field">
          <label className="simulator-inject-label">Preferred Start (Mandatory)</label>
          <input
            type="datetime-local"
            className="input"
            value={prefStart}
            onChange={(e) => setPrefStart(e.target.value)}
          />
        </div>

        <div className="simulator-inject-field">
          <label className="simulator-inject-label">Completion Deadline</label>
          <input
            type="datetime-local"
            className="input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="simulator-inject-field">
          <label className="simulator-inject-label">Lifecycle Status</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">PENDING (Awaiting Plan)</option>
            <option value="APPROVED">APPROVED (Ready to Schedule)</option>
            <option value="IN_PROGRESS">IN_PROGRESS (Invoked)</option>
            <option value="COMPLETED">COMPLETED (Finished)</option>
          </select>
        </div>
      </div>

      <div className="simulator-inject-footer">
        <p className="simulator-inject-note">
          💡 Real-time publisher/subscriber active: When submitted, the watcher ingests this request within 5 seconds.
          If it targets an active corridor block ({block || "B001"}), the 3-stage optimization engine automatically replans the schedule.
        </p>

        <div className="simulator-inject-actions">
          {result && (
            <span
              className="simulator-inject-result"
              style={{ color: result.ok ? "#16a34a" : "#ef4444" }}
            >
              {result.message}
            </span>
          )}
          <Button variant="primary" size="sm" onClick={handleInject} disabled={busy} style={{ minWidth: 120 }}>
            {busy ? "Injecting…" : "Publish Request"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function IncomingRequests() {
  const [filters,      setFilters]      = useState(EMPTY_FILTERS);
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(DEFAULT_PAGE_SIZE);
  const [selectedTask, setSelectedTask] = useState(null);

  const { liveStatus, newRequestCount, planUpdated, clearPlanUpdated } = useLiveEvents();

  // Auto-refresh counter — increments whenever live events arrive
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);

  // Refresh the list whenever a new request arrives
  useEffect(() => {
    if (newRequestCount > 0) {
      setLiveRefreshKey((k) => k + 1);
    }
  }, [newRequestCount]);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      source:      filters.source      || undefined,
      status:      filters.status      || undefined,
      urgency:     filters.urgency     || undefined,
      criticality: filters.criticality || undefined,
      overdueOnly: filters.overdueOnly ? "true" : undefined,
    }),
    [page, pageSize, filters]
  );

  const fetcher = useCallback(() => listIncomingRequests(params), [params, liveRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error, reload } = useApiQuery(fetcher, [JSON.stringify(params), liveRefreshKey]);

  const summary    = data?.data?.summary;
  const rows       = data?.data?.requests || [];
  const pagination = data?.pagination;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.external_ref, r.maintenance_type, r.asset?.asset_code, r.asset?.asset_name, r.block?.block_code, r.section?.section_code, r.source]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(1);
  }

  const columns = useMemo(
    () => [
      {
        key: "external_ref",
        label: "Request",
        render: (r) => (
          <span>
            <strong style={{ display: "block" }}>{r.external_ref || r.maintenance_task_id}</strong>
            <span className="cell-muted">{humanize(r.maintenance_type)}</span>
          </span>
        ),
      },
      {
        key: "source",
        label: "System",
        render: (r) => <Badge tone={SOURCE_TONE[r.source] || "gray"}>{r.source}</Badge>,
      },
      {
        key: "location",
        label: "Block · Package",
        render: (r) => {
          const pkg = getTaskWorkPackage(r);
          const isPending = String(r.status || "").toUpperCase() === "PENDING";
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <strong className="cell-mono">{r.block?.block_code || r.block_code || "—"}</strong>
                <span
                  className={`incoming-package-tag ${isPending ? "is-pending" : "is-assigned"}`}
                  title={isPending ? `Pending clubbing into ${pkg.package_id}` : `Assigned to Work Package ${pkg.package_id}`}
                >
                  {pkg.package_id}
                </span>
              </div>
              <span className="cell-muted" style={{ fontSize: 11 }}>
                {r.section?.section_code || r.section_code || r.asset?.asset_code || ""}
              </span>
            </div>
          );
        },
      },
      {
        key: "pcu",
        label: "P / C / U",
        render: (r) => (
          <span style={{ display: "inline-flex", gap: 4 }}>
            {pcuBadge(r.priority,    PRIORITY_TONE)}
            {pcuBadge(r.criticality, PRIORITY_TONE)}
            {pcuBadge(r.urgency,     PRIORITY_TONE)}
          </span>
        ),
      },
      {
        key: "duration_minutes",
        label: "Duration",
        render: (r) => formatDuration(r.duration_minutes),
      },
      {
        key: "received_at",
        label: "Ingested in RailSetu",
        render: (r) => {
          const rec = r.received_at || r.created_at || r.requested_at;
          const rel = formatRelativeTime(rec);
          const isVeryRecent = rec && (Date.now() - new Date(rec).getTime() < 15 * 60 * 1000);
          return (
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span className={`incoming-recent-time ${isVeryRecent ? "is-recent" : ""}`}>
                  {rel}
                </span>
                {isVeryRecent && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#38bdf8",
                      boxShadow: "0 0 6px #38bdf8",
                      animation: "livePulse 2s infinite",
                    }}
                    title="Recently ingested live request"
                  />
                )}
              </div>
              <span className="cell-muted" style={{ fontSize: 11 }}>
                {formatDateTime(rec)}
              </span>
            </div>
          );
        },
      },
      {
        key: "preferred_start",
        label: "Preferred Start",
        render: (r) => (
          <div>
            <strong className="incoming-preferred-start" style={{ display: "block", fontSize: 12 }}>
              {formatDateTime(r.preferred_start)}
            </strong>
            <span className="cell-muted" style={{ fontSize: 11 }}>
              Req: {formatDateTime(r.requested_at)}
            </span>
          </div>
        ),
      },
      {
        key: "deadline_tracking",
        label: "Deadline & Compliance",
        render: (r) => {
          const comp = getDeadlineCompliance(r);
          return (
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <Badge tone={comp.tone} dot>{comp.badgeText || comp.label}</Badge>
              </div>
              <span className="cell-muted" style={{ fontSize: 11, color: comp.tone === "red" ? "#f87171" : "var(--text-3)" }}>
                {comp.subtext || formatDateTime(r.deadline)}
              </span>
            </div>
          );
        },
      },
      {
        key: "status",
        label: "Status",
        render: (r) => {
          const isPending = String(r.status || "").toUpperCase() === "PENDING";
          return (
            <div
              style={{ cursor: "pointer" }}
              title={isPending ? "Click to view hold reasons and approve task" : "Click to view assigned work package"}
            >
              <Badge tone={statusTone(r.status)} dot>
                {r.status}
                {isPending && " ⚠️"}
              </Badge>
            </div>
          );
        },
      },

    ],
    []
  );

  const kpis = [
    { key: "TMS",   icon: Wrench, color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Engineering · TMS",  desc: "Track maintenance system" },
    { key: "SMMS",  icon: Signal, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  label: "Signalling · SMMS",  desc: "Signalling & telecom maintenance" },
    { key: "TDMS",  icon: Zap,    color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  label: "Traction · TDMS",    desc: "Traction distribution maintenance" },
    { key: "Total", icon: Inbox,  color: "var(--accent)", bg: "var(--accent-dim)", label: "Total Requests", desc: "All imported source requests" },
  ];

  const serverEmpty = !loading && !error && rows.length === 0;
  const clientEmpty = !loading && !error && rows.length > 0 && visible.length === 0;

  return (
    <>
      <PageHeader
        title={
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span style={{ letterSpacing: "-0.02em" }}>Incoming Maintenance Requests</span>

            {/* Live badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: liveStatus === "live" ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${liveStatus === "live" ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)"}`,
                color: liveStatus === "live" ? "#4ade80" : "var(--text-muted)",
                boxShadow: liveStatus === "live" ? "0 0 12px rgba(34,197,94,0.2)" : "none",
                lineHeight: 1,
              }}
              title={liveStatus === "live" ? "Live Pub/Sub WebSocket / SSE active" : "Status: " + liveStatus}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: liveStatus === "live" ? "#22c55e" : "#888",
                  boxShadow: liveStatus === "live" ? "0 0 8px #22c55e" : "none",
                  animation: liveStatus === "live" ? "livePulse 2s ease-in-out infinite" : "none",
                  flexShrink: 0,
                }}
              />
              <span>{liveStatus === "live" ? "LIVE" : liveStatus === "error" ? "Disconnected" : "Connecting…"}</span>
            </div>

            {/* New requests counter badge */}
            {newRequestCount > 0 && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  background: "rgba(245, 158, 11, 0.16)",
                  border: "1px solid rgba(245, 158, 11, 0.45)",
                  color: "#fbbf24",
                  boxShadow: "0 0 12px rgba(245, 158, 11, 0.25)",
                  lineHeight: 1,
                }}
              >
                <Zap size={13} style={{ fill: "#fbbf24", flexShrink: 0 }} />
                <span>+{newRequestCount} new</span>
              </div>
            )}
          </div>
        }
        subtitle="Engineering, signalling and traction requests pulled from railway source systems (TMS / SMMS / TDMS)"
      />

      {/* Plan-updated banner */}
      <PlanUpdatedBanner data={planUpdated} onDismiss={clearPlanUpdated} />

      <div className="summary-grid" style={{ marginBottom: "var(--s5)" }}>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            icon={kpi.icon}
            color={kpi.color}
            bgColor={kpi.bg}
            value={kpi.key === "Total" ? summary?.total ?? "—" : summary?.bySource?.[kpi.key] ?? "—"}
            label={kpi.label}
            desc={kpi.desc}
            loading={loading}
          />
        ))}
      </div>

      <SourceSyncBar onSynced={() => reload()} />

      {/* Test inject panel */}
      <div style={{ marginBottom: "var(--s4, 16px)" }}>
        <InjectPanel onInjected={() => setLiveRefreshKey((k) => k + 1)} />
      </div>

      <section className="card">
        <Filters tip="Filters update the API request. Search applies to the loaded page.">
          <FilterField label="Source System">
            <select
              className="select"
              value={filters.source}
              onChange={(e) => setFilter("source", e.target.value)}
              aria-label="Filter by source system"
            >
              <option value="">All</option>
              {SOURCE_NAMES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Status">
            <select
              className="select"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All</option>
              {MAINTENANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Urgency">
            <select
              className="select"
              value={filters.urgency}
              onChange={(e) => setFilter("urgency", e.target.value)}
              aria-label="Filter by urgency"
            >
              <option value="">All</option>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Criticality">
            <select
              className="select"
              value={filters.criticality}
              onChange={(e) => setFilter("criticality", e.target.value)}
              aria-label="Filter by criticality"
            >
              <option value="">All</option>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Search">
            <input
              type="text"
              className="input"
              placeholder="Request ID, asset, block…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search requests"
            />
          </FilterField>

          <FilterField label="Overdue only">
            <div style={{ display: "flex", alignItems: "center", height: "var(--ctrl-h)" }}>
              <input
                type="checkbox"
                checked={Boolean(filters.overdueOnly)}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, overdueOnly: e.target.checked }));
                  setPage(1);
                }}
                aria-label="Only show overdue requests"
              />
            </div>
          </FilterField>

          <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
        </Filters>

        <StateBlock
          loading={loading}
          error={error}
          isEmpty={serverEmpty || clientEmpty}
          loadingMessage="Loading incoming requests…"
          emptyMessage={
            serverEmpty
              ? "No incoming requests yet. Run a sync to pull data from the source systems."
              : "No requests match the current filters."
          }
          onRetry={() => reload()}
        >
          <div style={{ padding: "4px 8px 10px", fontSize: 11.5, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>💡 <strong>Tip:</strong> Click any request row to view its complete ingestion timestamp, execution milestones, and deadline compliance audit.</span>
          </div>

          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(r) => r.maintenance_task_id || r.external_ref}
            onRowClick={(row) => setSelectedTask(row)}
            ariaLabel="Incoming source maintenance requests"
          />

          {pagination && (
            <Pagination
              pagination={pagination}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              disabled={loading}
            />
          )}
        </StateBlock>
      </section>

      {/* ── Request Lifecycle Drawer ─────────────────────────── */}
      <RequestLifecycleDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={(updated) => {
          setSelectedTask(updated);
          reload();
        }}
      />

    </>
  );
}