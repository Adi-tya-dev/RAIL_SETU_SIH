import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Blocks, CalendarX2, Clock3, Filter, MapPin, RefreshCw, Search, TrainFront, Wrench, X, Zap } from "lucide-react";
import { listConflicts, detectConflicts } from "../api/conflicts.api";
import { useApi } from "../hooks/useApi";
import { useRoute, navigate } from "../hooks/useRoute";
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
  TRAIN_TRAIN_MOVEMENT: Zap,
  BLOCK_UNAVAILABLE: Blocks,
  DEADLINE_VIOLATION: Clock3,
  TIME_WINDOW_CONFLICT: CalendarX2,
};
const FALLBACK_ICON = AlertTriangle;

const TYPE_LABEL = {
  TRAIN_MAINTENANCE: "Train ↔ Maintenance",
  MAINTENANCE_MAINTENANCE: "Maintenance ↔ Maintenance",
  TRAIN_TRAIN_MOVEMENT: "Train ↔ Train",
  BLOCK_UNAVAILABLE: "Block Unavailable",
  DEADLINE_VIOLATION: "Deadline Violation",
  TIME_WINDOW_CONFLICT: "Time Window Conflict",
};

function TypeCell({ type }) {
  const Icon = TYPE_ICONS[type] || FALLBACK_ICON;
  return (
    <span className="cell-strong type-cell">
      <Icon size={15} />
      {TYPE_LABEL[type] || humanize(type) || "Conflict"}
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

export default function Conflicts() {
  const { data, loading, error, run } = useApi();
  const detectApi = useApi();
  const [selected, setSelected] = useState(null);
  const [detectMsg, setDetectMsg] = useState(null);

  // URL Query Parameters (e.g. from Railway Map or Train Drawer)
  const currentRoute = useRoute();
  const queryParams = useMemo(() => {
    const qIndex = currentRoute.indexOf("?");
    return qIndex >= 0 ? new URLSearchParams(currentRoute.slice(qIndex + 1)) : new URLSearchParams();
  }, [currentRoute]);

  const targetTrainNumber = queryParams.get("trainNumber") || "";
  const targetTrainName = queryParams.get("trainName") || "";
  const targetTrainId = queryParams.get("trainId") || "";
  const targetBlock = queryParams.get("block") || "";
  const targetConflictId = queryParams.get("conflictId") || "";

  const [activeTarget, setActiveTarget] = useState(() => {
    if (targetTrainNumber || targetTrainId || targetBlock || targetConflictId) {
      return {
        trainNumber: targetTrainNumber,
        trainName: targetTrainName,
        trainId: targetTrainId,
        block: targetBlock,
        conflictId: targetConflictId,
      };
    }
    return null;
  });

  const [filterMode, setFilterMode] = useState("targeted"); // "targeted" | "all"
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  useEffect(() => {
    if (targetTrainNumber || targetTrainId || targetBlock || targetConflictId) {
      setActiveTarget({
        trainNumber: targetTrainNumber,
        trainName: targetTrainName,
        trainId: targetTrainId,
        block: targetBlock,
        conflictId: targetConflictId,
      });
      setFilterMode("targeted");
    }
  }, [targetTrainNumber, targetTrainId, targetBlock, targetConflictId, targetTrainName]);

  const load = useCallback(
    () =>
      run(async () => {
        const result = await listConflicts({ limit: 200 });
        const conflicts = [...(result.data || [])].sort((a, b) => (b.severity || 0) - (a.severity || 0));
        return { planCount: result.planCount, conflicts };
      }),
    [run]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleDetect = useCallback(async () => {
    setDetectMsg(null);
    await detectApi.run(async () => {
      const res = await detectConflicts(true); // force=true to re-detect
      setDetectMsg(res?.message || `Detection complete. Created ${res?.created ?? "?"} conflicts.`);
      return res;
    });
    // Reload after detection
    await load();
  }, [detectApi, load]);

  const conflicts = data?.conflicts || [];
  const planCount = data?.planCount || 0;

  // Matching function to identify if a conflict involves the target train/block/id
  const isConflictTargeted = useCallback((c) => {
    if (!activeTarget) return false;
    const { trainNumber, trainId, block, conflictId } = activeTarget;
    if (conflictId && (String(c.conflict_id) === String(conflictId) || String(c.id) === String(conflictId))) {
      return true;
    }
    if (trainNumber) {
      const tNum = String(trainNumber).trim();
      const directNum = c.train && String(c.train.train_number) === tNum;
      const inTrainId = String(c.train_id) === tNum;
      const inDesc = c.description && c.description.includes(tNum);
      if (directNum || inTrainId || inDesc) return true;
    }
    if (trainId) {
      const tId = String(trainId).trim();
      if (String(c.train_id) === tId || String(c.train?.train_id) === tId) {
        return true;
      }
    }
    if (block) {
      const bCode = String(block).trim().toUpperCase();
      if (
        String(c.block?.block_code || "").toUpperCase() === bCode ||
        String(c.block_id || "").toUpperCase() === bCode ||
        (c.description && c.description.toUpperCase().includes(bCode))
      ) {
        return true;
      }
    }
    return false;
  }, [activeTarget]);

  // Auto-open drawer if specific conflictId requested
  useEffect(() => {
    if (targetConflictId && conflicts.length > 0) {
      const found = conflicts.find((c) => String(c.conflict_id) === String(targetConflictId));
      if (found) {
        setSelected(found);
      }
    }
  }, [targetConflictId, conflicts]);

  const targetedCount = useMemo(() => {
    if (!activeTarget) return 0;
    return conflicts.filter(isConflictTargeted).length;
  }, [conflicts, activeTarget, isConflictTargeted]);

  const displayedConflicts = useMemo(() => {
    let result = conflicts;

    // Filter by target if in "targeted" mode
    if (activeTarget && filterMode === "targeted") {
      result = result.filter(isConflictTargeted);
    }

    // Type filter
    if (typeFilter !== "ALL") {
      result = result.filter((c) => c.conflict_type === typeFilter);
    }

    // Severity filter
    if (severityFilter !== "ALL") {
      result = result.filter((c) => String(c.severity) === severityFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const desc = (c.description || "").toLowerCase();
        const type = (c.conflict_type || "").toLowerCase();
        const tNum = String(c.train?.train_number || c.train_id || "").toLowerCase();
        const tName = (c.train?.train_name || "").toLowerCase();
        const bCode = (c.block?.block_code || "").toLowerCase();
        return desc.includes(q) || type.includes(q) || tNum.includes(q) || tName.includes(q) || bCode.includes(q);
      });
    }

    // In "all" mode with target active, sort targeted conflicts to the very top!
    if (activeTarget && filterMode === "all") {
      result = [...result].sort((a, b) => {
        const aTarget = isConflictTargeted(a);
        const bTarget = isConflictTargeted(b);
        if (aTarget && !bTarget) return -1;
        if (!aTarget && bTarget) return 1;
        return (b.severity || 0) - (a.severity || 0);
      });
    }

    return result;
  }, [conflicts, activeTarget, filterMode, isConflictTargeted, typeFilter, severityFilter, searchQuery]);

  const stats = useMemo(() => {
    const open = conflicts.filter((c) => !c.resolved).length;
    const critical = conflicts.filter((c) => Number(c.severity) >= 4).length;
    const uniqueBlocks = new Set(conflicts.map((c) => c.block?.block_code || c.block_id).filter(Boolean)).size;
    const uniqueTrains = new Set(conflicts.map((c) => c.train?.train_number || c.train_id).filter(Boolean)).size;
    const trainMaint = conflicts.filter((c) => c.conflict_type === "TRAIN_MAINTENANCE").length;
    const trainTrain = conflicts.filter((c) => c.conflict_type === "TRAIN_TRAIN_MOVEMENT").length;
    const maintMaint = conflicts.filter((c) => c.conflict_type === "MAINTENANCE_MAINTENANCE").length;
    return { total: conflicts.length, open, critical, uniqueBlocks, uniqueTrains, trainMaint, trainTrain, maintMaint };
  }, [conflicts]);

  const columns = useMemo(() => [
    {
      key: "conflict_type",
      label: "Conflict",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <TypeCell type={r.conflict_type} />
          {isConflictTargeted(r) && (
            <span className="conflict-target-chip" title="Directly affects your selected train/corridor">
              Target Focus
            </span>
          )}
        </div>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      render: (r) => <Badge tone={SEVERITY_TONE[r.severity] || "gray"}>{r.severity != null ? `${r.severity} · ${SEVERITY_LABEL[r.severity]}` : "—"}</Badge>,
    },
    { key: "block", label: "Block", render: (r) => <BlockCell block={r.block} /> },
    {
      key: "train",
      label: "Train",
      render: (r) => (
        <div>
          <TrainCell train={r.train} />
          {isConflictTargeted(r) && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
              Focused Train Conflict
            </div>
          )}
        </div>
      ),
    },
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
  ], [isConflictTargeted]);

  const isUnavailable = error && (error.status === 501 || error.status === 404);

  function clearTargetFilter() {
    setActiveTarget(null);
    setFilterMode("all");
    navigate("/conflicts");
  }

  return (
    <>
      <PageHeader
        title="Conflict Analysis"
        subtitle="Detected conflicts across plans and operations"
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button
              variant="secondary"
              loading={detectApi.loading}
              loadingText="Detecting…"
              onClick={handleDetect}
              title="Re-scan all train movements and maintenance tasks for conflicts"
            >
              <RefreshCw size={15} />
              Re-detect
            </Button>
            <Button variant="primary" loading={loading} loadingText="Loading…" onClick={load}>
              Load / Refresh
            </Button>
          </div>
        }
      />

      {detectMsg && (
        <div className="railway-map-alert railway-map-alert--success" style={{ marginBottom: 16 }}>
          ✓ {detectMsg}
        </div>
      )}

      {/* Target Focus Banner when navigated for a specific train or block */}
      {activeTarget && (
        <div className="conflict-active-banner">
          <div className="conflict-active-banner__left">
            <span className="conflict-active-banner__pulse" />
            <div>
              <strong>
                Target Focus: Train {activeTarget.trainNumber || activeTarget.trainId || "Selected"}
                {activeTarget.trainName ? ` — ${activeTarget.trainName}` : ""}
                {activeTarget.block ? ` · Block ${activeTarget.block}` : ""}
              </strong>
              <p>
                {filterMode === "targeted"
                  ? `Showing only ${targetedCount} conflict${targetedCount === 1 ? "" : "s"} identified for this train.`
                  : `Showing all ${conflicts.length} conflicts (${targetedCount} target conflicts pinned to top & highlighted).`}
              </p>
            </div>
          </div>
          <div className="conflict-active-banner__actions">
            {filterMode === "targeted" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setFilterMode("all")}
                title="Show all conflicts while keeping target conflicts highlighted"
              >
                View all ({conflicts.length}) with target highlighted
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setFilterMode("targeted")}
                title="Filter table to only target train conflicts"
              >
                Show only Train {activeTarget.trainNumber || ""} conflicts ({targetedCount})
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={clearTargetFilter}
              title="Clear target filter"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <X size={14} /> Clear filter
            </Button>
          </div>
        </div>
      )}

      <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 16 }}>
        <div className="summary-card summary-card--amber">
          <div className="summary-card__label">Total Conflicts</div>
          <div className="summary-card__value">{stats.total}</div>
          <div className="summary-card__sub">{stats.open === stats.total ? "All currently open / unresolved" : `${stats.open} open · ${stats.total - stats.open} resolved`}</div>
        </div>
        <div className="summary-card summary-card--red">
          <div className="summary-card__label">Critical Severity</div>
          <div className="summary-card__value">{stats.critical}</div>
          <div className="summary-card__sub">Level 4 & 5 collision priority</div>
        </div>
        <div className="summary-card summary-card--blue">
          <div className="summary-card__label">Affected Blocks</div>
          <div className="summary-card__value">{stats.uniqueBlocks}</div>
          <div className="summary-card__sub">Simultaneous block occupancy</div>
        </div>
        <div className="summary-card summary-card--violet">
          <div className="summary-card__label">Impacted Trains</div>
          <div className="summary-card__value">{stats.uniqueTrains}</div>
          <div className="summary-card__sub">Scheduled services involved</div>
        </div>
      </div>

      <section className="card mt-16">
        <div className="card__head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2>Detected Conflicts</h2>
              <p>
                {activeTarget && filterMode === "targeted"
                  ? `Filtered for Train ${activeTarget.trainNumber} · ${displayedConflicts.length} conflict(s)`
                  : "Real-time detected operational conflicts across network blocks, scheduled maintenance, and train paths."}
              </p>
            </div>
            {activeTarget && filterMode === "targeted" && (
              <span className="badge badge--red" style={{ fontSize: 11, padding: "3px 9px" }}>
                Filtered: {targetedCount} of {conflicts.length}
              </span>
            )}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="conflict-filter-bar">
          <div className="conflict-filter-search">
            <Search size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by train number, name, block code, or summary..."
            />
          </div>
          <select
            className="select"
            style={{ width: "auto", minWidth: 160, height: 36, fontSize: 12 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Conflict Types</option>
            <option value="TRAIN_TRAIN_MOVEMENT">Train ↔ Train</option>
            <option value="TRAIN_MAINTENANCE">Train ↔ Maintenance</option>
            <option value="MAINTENANCE_MAINTENANCE">Maintenance ↔ Maintenance</option>
            <option value="BLOCK_UNAVAILABLE">Block Unavailable</option>
            <option value="DEADLINE_VIOLATION">Deadline Violation</option>
          </select>
          <select
            className="select"
            style={{ width: "auto", minWidth: 140, height: 36, fontSize: 12 }}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">All Severities</option>
            <option value="5">Level 5 · Critical</option>
            <option value="4">Level 4 · High</option>
            <option value="3">Level 3 · Medium</option>
            <option value="2">Level 2 · Low</option>
          </select>
          {(searchQuery || typeFilter !== "ALL" || severityFilter !== "ALL") && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("ALL");
                setSeverityFilter("ALL");
              }}
            >
              Reset filters
            </Button>
          )}
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

        {!loading && !error && displayedConflicts.length === 0 && (
          <div className="state state--empty">
            {activeTarget
              ? `No conflicts matched the current filter for Train ${activeTarget.trainNumber}.`
              : "No active conflicts detected."}
            <div style={{ marginTop: 10 }}>
              {activeTarget && (
                <Button size="sm" variant="secondary" onClick={clearTargetFilter} style={{ marginRight: 8 }}>
                  View All Network Conflicts
                </Button>
              )}
              <Button size="sm" onClick={load}>Reload Conflicts</Button>
            </div>
          </div>
        )}

        {!loading && !error && displayedConflicts.length > 0 && (
          <DataTable
            columns={columns}
            rows={displayedConflicts}
            ariaLabel="Detected conflicts"
            rowKey={(r, i) => String(r.conflict_id ?? i)}
            onRowClick={setSelected}
            rowClassName={(r) => isConflictTargeted(r) ? "row-highlighted" : ""}
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
                  { label: "Type", value: TYPE_LABEL[selected.conflict_type] || humanize(selected.conflict_type) || "—" },
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

            {selected.train && (
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
                      value: `${selected.train.origin_station?.station_code || "?"} → ${selected.train.destination_station?.station_code || "?"}`,
                    },
                  ]}
                />
              </DetailSection>
            )}

            {(selected.maintenance_task || selected.plan?.plan_maintenance_tasks?.[0]?.maintenance_task) && (() => {
              const mt = selected.maintenance_task || selected.plan?.plan_maintenance_tasks?.[0]?.maintenance_task;
              return (
                <DetailSection title="Affected Maintenance Task">
                  <DetailList
                    items={[
                      { label: "Task Type", value: <span className="mono">{mt.maintenance_type || "—"}</span> },
                      { label: "Department", value: mt.department || "—" },
                      { label: "Criticality", value: <Badge tone={Number(mt.criticality) >= 4 ? "red" : "amber"}>{`Level ${mt.criticality}`}</Badge> },
                      { label: "Duration", value: `${mt.duration_minutes || 60} minutes` },
                      { label: "Preferred Start", value: mt.preferred_start ? new Date(mt.preferred_start).toLocaleString() : "—" },
                      { label: "Status", value: <Badge tone="blue">{mt.status || "SCHEDULED"}</Badge> },
                    ]}
                  />
                </DetailSection>
              );
            })()}
          </div>
        )}
      </Drawer>
    </>
  );
}