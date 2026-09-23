import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Blocks, CalendarX2, Clock3, TrainFront, Wrench, MapPin } from "lucide-react";
import { listConflicts } from "../api/conflicts.api";
import { useApi } from "../hooks/useApi";
import { navigate } from "../hooks/useRoute";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import DataTable from "../components/common/DataTable";
import Drawer from "../components/common/Drawer";
import { DetailSection, DetailList } from "../components/common/DetailList";
import { humanize } from "../utils/formatters";
import { SEVERITY_TONE, SEVERITY_LABEL, trainPriorityBadge } from "../utils/constants";

const TYPE_ICONS = {
  TRAIN_MAINTENANCE: TrainFront,
  MAINTENANCE_MAINTENANCE: Wrench,
  BLOCK_UNAVAILABLE: Blocks,
  DEADLINE_VIOLATION: Clock3,
  TIME_WINDOW_CONFLICT: CalendarX2,
};
const FALLBACK_ICON = AlertTriangle;

function TypeCell({ type }) {
  const Icon = TYPE_ICONS[type] || FALLBACK_ICON;
  return (
    <span className="cell-strong type-cell">
      <Icon size={15} />
      {humanize(type) || "Conflict"}
    </span>
  );
}

function TrainCell({ train }) {
  if (!train) return <span className="text-muted">—</span>;
  return (
    <span className="cell-strong">
      <span className="cell-mono">{train.train_number || train.train_id || "—"}</span>
      <span className="cell-sub">{train.train_name || ""}</span>
    </span>
  );
}

function BlockCell({ block }) {
  if (!block) return <span className="text-muted">—</span>;
  return (
    <span className="cell-strong">
      <span className="cell-mono">{block.block_code}</span>
      <span className="cell-sub">{block.track?.section?.section_code || block.section_code || ""}</span>
    </span>
  );
}

const COLUMNS = [
  { key: "conflict_type", label: "Conflict", render: (r) => <TypeCell type={r.conflict_type} /> },
  {
    key: "severity",
    label: "Severity",
    render: (r) => <Badge tone={SEVERITY_TONE[r.severity] || "gray"}>{r.severity != null ? `${r.severity} · ${SEVERITY_LABEL[r.severity]}` : "—"}</Badge>,
  },
  { key: "block", label: "Block", render: (r) => <BlockCell block={r.block} /> },
  { key: "train", label: "Train", render: (r) => <TrainCell train={r.train} /> },
  {
    key: "description",
    label: "Summary",
    render: (r) => <span className="cell-muted">{r.description || "—"}</span>,
  },
  {
    key: "resolved",
    label: "Status",
    render: (r) => <Badge tone={r.resolved ? "green" : "red"} dot>{r.resolved ? "Resolved" : "Open"}</Badge>,
  },
];

export default function Conflicts() {
  const { data, loading, error, run } = useApi();
  const [selected, setSelected] = useState(null);

  const load = useCallback(
    () =>
      run(async () => {
        const result = await listConflicts({ limit: 50 });
        const conflicts = [...(result.data || [])].sort((a, b) => (b.severity || 0) - (a.severity || 0));
        return { planCount: result.planCount, conflicts };
      }),
    [run]
  );

  useEffect(() => {
    load();
  }, [load]);

  const conflicts = data?.conflicts || [];
  const planCount = data?.planCount || 0;

  const stats = useMemo(() => {
    const open = conflicts.filter((c) => !c.resolved).length;
    const critical = conflicts.filter((c) => Number(c.severity) >= 4).length;
    return { total: conflicts.length, open, critical };
  }, [conflicts]);

  const isUnavailable = error && (error.status === 501 || error.status === 404);

  return (
    <>
      <PageHeader
        title="Conflict Analysis"
        subtitle="Detected conflicts across plans and operations"
        actions={
          <Button variant="primary" loading={loading} loadingText="Loading…" onClick={load}>
            Load / Refresh
          </Button>
        }
      />

      <div className="summary-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="summary-card summary-card--amber">
          <div className="summary-card__label">Total Conflicts</div>
          <div className="summary-card__value">{stats.total}</div>
        </div>
        <div className="summary-card summary-card--red">
          <div className="summary-card__label">Open Conflicts</div>
          <div className="summary-card__value">{stats.open}</div>
        </div>
        <div className="summary-card summary-card--orange">
          <div className="summary-card__label">Critical Severity</div>
          <div className="summary-card__value">{stats.critical}</div>
        </div>
      </div>

      <section className="card mt-16">
        <div className="card__head">
          <div>
            <h2>Detected Conflicts</h2>
            <p>
              Real-time detected operational conflicts across network blocks, scheduled maintenance, and train paths.
            </p>
          </div>
        </div>

        {loading && (
          <div className="state state--loading" role="status">
            <span className="spinner" />
            <p>Analyzing schedules for conflicts…</p>
          </div>
        )}

        {!loading && error && (
          <div className="state state--error" role="alert">
            <p className="state__title">
              {isUnavailable ? "Conflicts data is not available yet" : "Unable to load conflict data"}
            </p>
            <p>
              {isUnavailable
                ? "The schedules endpoint is not available, so conflicts cannot be derived."
                : error.message}
            </p>
            <Button size="sm" onClick={load}>Retry</Button>
          </div>
        )}

        {!loading && !error && conflicts.length === 0 && (
          <div className="state state--empty">
            No active conflicts detected. All scheduled maintenance windows are fully optimized and coordinated with train movements.
          </div>
        )}

        {!loading && !error && conflicts.length > 0 && (
          <DataTable
            columns={COLUMNS}
            rows={conflicts}
            ariaLabel="Detected conflicts"
            rowKey={(r, i) => String(r.conflict_id ?? i)}
            onRowClick={setSelected}
          />
        )}
      </section>
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Conflict Details"
        subtitle={selected ? `Plan ${selected.plan_id || "—"}` : ""}
        footer={
          selected && (
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tId = selected.train_id || selected.train?.train_id || "";
                  const tNum = selected.train?.train_number || "";
                  const bCode = selected.block?.block_code || "";
                  navigate(`/map?trainId=${tId}&trainNumber=${tNum}&block=${bCode}&conflict=true&conflictId=${selected.conflict_id || ""}`);
                }}
                style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
              >
                <MapPin size={13} style={{ marginRight: 6, color: "#ef4444" }} />
                View on Live Map
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          )
        }
      >
        {selected && (
          <div className="stack">
            {selected.description && (
              <div className="conflict-callout" role="note">
                <AlertTriangle size={16} aria-hidden="true" />
                <p>{selected.description}</p>
              </div>
            )}

            <DetailSection title="Conflict">
              <DetailList
                items={[
                  { label: "Type", value: humanize(selected.conflict_type) || "—" },
                  {
                    label: "Severity",
                    value: selected.severity != null ? <Badge tone={SEVERITY_TONE[selected.severity] || "gray"}>{SEVERITY_LABEL[selected.severity] || selected.severity}</Badge> : "—",
                  },
                  {
                    label: "Status",
                    value: <Badge tone={selected.resolved ? "green" : "red"} dot>{selected.resolved ? "Resolved" : "Open"}</Badge>,
                  },
                  { label: "Plan", value: <span className="mono">{selected.plan_id || "—"}</span> },
                ]}
              />
            </DetailSection>

            <DetailSection title="Affected Block">
              <DetailList
                items={[
                  { label: "Block Code", value: <span className="mono">{selected.block?.block_code || "—"}</span> },
                  { label: "Section", value: selected.block?.track?.section?.section_code || selected.block?.section_code || "—" },
                  { label: "Track", value: selected.block?.track?.track_code || "—" },
                  { label: "Chainage", value: selected.block ? `${Number(selected.block.start_chainage || 0).toFixed(2)} – ${Number(selected.block.end_chainage || 0).toFixed(2)} km` : "—" },
                ]}
              />
            </DetailSection>

            <DetailSection title="Affected Train">
              <DetailList
                items={[
                  { label: "Train Number", value: <span className="mono">{selected.train?.train_number || "—"}</span> },
                  { label: "Train Name", value: selected.train?.train_name || "—" },
                  { label: "Type", value: selected.train?.train_type || "—" },
                  {
                    label: "Priority",
                    value: selected.train?.priority != null
                      ? <Badge tone={trainPriorityBadge(selected.train.priority).tone}>{trainPriorityBadge(selected.train.priority).label}</Badge>
                      : "—",
                  },
                  {
                    label: "Route",
                    value: selected.train ? `${selected.train.origin_station?.station_code || "?"} → ${selected.train.destination_station?.station_code || "?"}` : "—",
                  },
                ]}
              />
            </DetailSection>
          </div>
        )}
      </Drawer>
    </>
  );
}