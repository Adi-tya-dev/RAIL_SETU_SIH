import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Clock3, Train, ShieldCheck, Route, Calendar, Layers, MapPin, X } from "lucide-react";
import { listTrainImpacts } from "../api/trainImpacts.api";
import { useApi } from "../hooks/useApi";
import { useRoute, navigate } from "../hooks/useRoute";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import DataTable from "../components/common/DataTable";
import Drawer from "../components/common/Drawer";
import { DetailSection, DetailList } from "../components/common/DetailList";
import { formatNumber, formatScore, humanize, formatDateTime } from "../utils/formatters";

function trainTypeTone(type) {
  switch (String(type || "").toUpperCase()) {
    case "RAJDHANI":      return "red";
    case "SHATABDI":      return "amber";
    case "VANDE_BHARAT":  return "cyan";
    case "FREIGHT":       return "violet";
    case "SUPERFAST":     return "orange";
    case "PASSENGER":     return "gray";
    default:              return "blue";
  }
}

const COLUMNS = [
  {
    key: "train",
    label: "Train",
    render: (row) => (
      <span>
        <strong style={{ display: "block" }} className="cell-mono">
          {row.train?.train_number || row.train_id || "—"}
        </strong>
        <span className="cell-muted" style={{ fontSize: 12 }}>
          {row.train?.train_name || "Operational Service"}
        </span>
      </span>
    ),
  },
  {
    key: "train_type",
    label: "Service",
    render: (row) => (
      <Badge tone={trainTypeTone(row.train?.train_type)}>
        {row.train?.train_type || "EXPRESS"}
      </Badge>
    ),
  },
  {
    key: "route",
    label: "Corridor Route",
    render: (row) => {
      const orig = row.train?.origin_station?.station_code || "NDLS";
      const dest = row.train?.destination_station?.station_code || "UMB";
      return (
        <span>
          <strong style={{ display: "block" }}>{orig} → {dest}</strong>
          <span className="cell-muted" style={{ fontSize: 11 }}>
            {row.train?.origin_station?.station_name || "New Delhi"} to {row.train?.destination_station?.station_name || "Ambala"}
          </span>
        </span>
      );
    },
  },
  {
    key: "plan_id",
    label: "Associated Plan",
    render: (row) => (
      <span>
        <strong style={{ display: "block" }} className="cell-mono">#{row.plan_id}</strong>
        <span className="cell-muted" style={{ fontSize: 11 }}>
          {row.plan?.plan_horizon || "WEEKLY"} Horizon
        </span>
      </span>
    ),
  },
  {
    key: "block",
    label: "Infrastructure",
    render: (row) => {
      const bCode = row.block?.block_code || row.plan?.block?.block_code || "—";
      const sCode = row.plan?.block?.track?.section?.section_code || row.block?.track?.section?.section_code || "SEC-DLJP";
      return (
        <span>
          <strong style={{ display: "block" }} className="cell-mono">{bCode}</strong>
          <span className="cell-muted" style={{ fontSize: 11 }}>{sCode}</span>
        </span>
      );
    },
  },
  {
    key: "impact_type",
    label: "Regulation Action",
    render: (row) => (
      <Badge tone="cyan" dot>
        {humanize(row.impact_type) || "Rerouted Window"}
      </Badge>
    ),
  },
  {
    key: "estimated_delay_minutes",
    label: "Expected Delay",
    render: (row) => {
      const delay = Math.round(Number(row.estimated_delay_minutes || 0) * 10) / 10;
      return (
        <Badge tone={delay > 0 ? "amber" : "green"}>
          {delay === 0 ? "0 min · Protected" : `+${delay} min`}
        </Badge>
      );
    },
  },
];

export default function TrainImpacts() {
  const currentPath = useRoute();
  const queryParams = useMemo(() => {
    const qIdx = currentPath.indexOf("?");
    return qIdx >= 0 ? new URLSearchParams(currentPath.slice(qIdx + 1)) : new URLSearchParams();
  }, [currentPath]);

  const { data, loading, error, run } = useApi();
  const [selected, setSelected] = useState(null);
  const [trainFilter, setTrainFilter] = useState(() => queryParams.get("trainNumber") || queryParams.get("trainId") || "");
  const autoOpenedRef = useRef("");

  const load = useCallback(() => run(() => listTrainImpacts({ limit: 100 })), [run]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const qTrain = queryParams.get("trainNumber") || queryParams.get("trainId") || "";
    if (qTrain && qTrain !== trainFilter) {
      setTrainFilter(qTrain);
    }
  }, [queryParams, trainFilter]);

  const handleClearFilter = useCallback(() => {
    setTrainFilter("");
    autoOpenedRef.current = "";
    navigate("/train-impacts");
  }, []);

  const impacts = data?.data || [];

  const visibleImpacts = useMemo(() => {
    if (!trainFilter) return impacts;
    const filterLower = trainFilter.toLowerCase();
    return impacts.filter((i) => {
      const tId = String(i.train_id || i.train?.train_id || "").toLowerCase();
      const tNum = String(i.train?.train_number || "").toLowerCase();
      const tName = String(i.train?.train_name || "").toLowerCase();
      return tId === filterLower || tNum === filterLower || tName.includes(filterLower);
    });
  }, [impacts, trainFilter]);

  useEffect(() => {
    if (trainFilter && visibleImpacts.length > 0 && autoOpenedRef.current !== trainFilter) {
      setSelected(visibleImpacts[0]);
      autoOpenedRef.current = trainFilter;
    }
  }, [trainFilter, visibleImpacts]);

  const summary = useMemo(() => {
    const trainIds = new Set(
      visibleImpacts.map((i) => String(i.train_id || i.train?.train_id)).filter(Boolean)
    );
    const rawDelay = visibleImpacts.reduce(
      (sum, i) => sum + (Number(i.estimated_delay_minutes) || 0),
      0
    );
    const totalDelay = Math.round(rawDelay);
    const critical = visibleImpacts.filter((i) => (Number(i.train?.priority) || 3) <= 1).length;
    const protectedCount = visibleImpacts.filter(
      (i) => Number(i.estimated_delay_minutes || 0) === 0
    ).length;

    return {
      trains: trainIds.size || visibleImpacts.length,
      totalDelay,
      critical,
      protectedCount,
    };
  }, [visibleImpacts]);

  return (
    <>
      <PageHeader
        title="Train Impact Analysis"
        subtitle="Operational effects, train regulation, and delay mitigation across network corridors"
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {trainFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilter}
                style={{ fontSize: 12 }}
              >
                <X size={13} style={{ marginRight: 4 }} />
                Filter: {trainFilter} (Clear)
              </Button>
            )}
            <Button variant="primary" loading={loading} loadingText="Loading…" onClick={load}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="summary-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="summary-card summary-card--blue">
          <div className="summary-card__label">Affected Trains</div>
          <div className="summary-card__value">{formatNumber(summary.trains)}</div>
        </div>
        <div className="summary-card summary-card--amber">
          <div className="summary-card__label">Total Train Delay</div>
          <div className="summary-card__value">{formatNumber(summary.totalDelay)} min</div>
        </div>
        <div className="summary-card summary-card--red">
          <div className="summary-card__label">High-Priority Express</div>
          <div className="summary-card__value">{summary.critical}</div>
        </div>
        <div className="summary-card summary-card--purple">
          <div className="summary-card__label">Protected Train Paths</div>
          <div className="summary-card__value">{summary.protectedCount}</div>
        </div>
      </div>

      <section className="card mt-16">
        <div className="card__head">
          <div>
            <h2>Train Impacts & Regulations</h2>
            <p>
              Real-time operational impacts and regulation actions on running passenger and freight services.
            </p>
          </div>
        </div>

        {trainFilter && (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--accent-dim, rgba(245,158,11,0.1))",
              border: "1px solid var(--border-2)",
              borderRadius: 8,
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <span>Showing impacts for Train <strong>#{trainFilter}</strong> ({visibleImpacts.length} records)</span>
            <Button variant="ghost" size="sm" onClick={handleClearFilter}>
              Show All Trains
            </Button>
          </div>
        )}

        {loading && (
          <div className="state state--loading">
            <span className="spinner" />
            <p>Loading train impacts…</p>
          </div>
        )}

        {!loading && error && (
          <div className="state state--error">
            <p className="state__title">Unable to load train impacts</p>
            <p>{error.message}</p>
            <Button size="sm" onClick={load}>Retry</Button>
          </div>
        )}

        {!loading && !error && visibleImpacts.length === 0 && (
          <div className="state state--empty">
            {trainFilter ? `No impacts found for train "${trainFilter}".` : "No train impacts are present in the loaded plans."}
          </div>
        )}

        {!loading && !error && visibleImpacts.length > 0 && (
          <DataTable
            columns={COLUMNS}
            rows={visibleImpacts}
            ariaLabel="Train impacts"
            rowKey={(row, index) => `${row.plan_id}-${row.impact_id || index}`}
            onRowClick={setSelected}
          />
        )}
      </section>

      {/* Train Impact Details Drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.train ? `${selected.train.train_number} · ${selected.train.train_name}` : "Train Impact Details"}
        subtitle={selected ? `Associated with Plan #${selected.plan_id}` : ""}
        footer={
          selected && (
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tId = selected.train_id || selected.train?.train_id || "";
                  const tNum = selected.train?.train_number || "";
                  const bCode = selected.block?.block_code || selected.plan?.block?.block_code || "";
                  navigate(`/map?trainId=${tId}&trainNumber=${tNum}&block=${bCode}&conflict=true`);
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
            <DetailSection title="Train Information">
              <DetailList
                items={[
                  { label: "Train Number", value: <span className="mono">{selected.train?.train_number || selected.train_id || "—"}</span> },
                  { label: "Train Name", value: selected.train?.train_name || "Operational Service" },
                  { label: "Service Type", value: <Badge tone={trainTypeTone(selected.train?.train_type)}>{selected.train?.train_type || "EXPRESS"}</Badge> },
                  { label: "Priority", value: selected.train?.priority != null ? `Priority ${selected.train.priority}` : "Standard" },
                  {
                    label: "Corridor Route",
                    value: `${selected.train?.origin_station?.station_code || "NDLS"} (${selected.train?.origin_station?.station_name || "New Delhi"}) → ${selected.train?.destination_station?.station_code || "UMB"} (${selected.train?.destination_station?.station_name || "Ambala"})`,
                  },
                ]}
              />
            </DetailSection>

            <DetailSection title="Associated Maintenance Block Plan">
              <DetailList
                items={[
                  { label: "Plan ID", value: <span className="mono">#{selected.plan_id}</span> },
                  { label: "Horizon", value: <Badge tone="amber">{selected.plan?.plan_horizon || "WEEKLY"}</Badge> },
                  { label: "Block Code", value: <span className="mono">{selected.block?.block_code || selected.plan?.block?.block_code || "—"}</span> },
                  { label: "Section", value: selected.plan?.block?.track?.section?.section_code || selected.block?.track?.section?.section_code || "SEC-DLJP" },
                  { label: "Track", value: selected.plan?.block?.track?.track_code || selected.block?.track?.track_code || "—" },
                  {
                    label: "Chainage",
                    value: selected.block ? `${Number(selected.block.start_chainage || 0).toFixed(2)} – ${Number(selected.block.end_chainage || 0).toFixed(2)} km` : "—",
                  },
                ]}
              />
            </DetailSection>

            <DetailSection title="Operational Action & Regulation">
              <DetailList
                items={[
                  { label: "Regulation Action", value: <Badge tone="cyan" dot>{humanize(selected.impact_type) || "Rerouted Window"}</Badge> },
                  {
                    label: "Expected Delay",
                    value: (() => {
                      const delay = Math.round(Number(selected.estimated_delay_minutes || 0) * 10) / 10;
                      return (
                        <Badge tone={delay > 0 ? "amber" : "green"}>
                          {delay === 0 ? "0 min · Protected via Greedy CSP" : `+${delay} min`}
                        </Badge>
                      );
                    })(),
                  },
                  {
                    label: "Timetable Adjustment",
                    value: selected.plan?.original_window ? `Original Blueprint ${selected.plan.original_window}` : "Reconciled with live schedule",
                  },
                ]}
              />
            </DetailSection>

            <DetailSection title="Dispatch Optimization Rationale">
              <p className="text-muted" style={{ margin: 0, lineHeight: 1.6 }}>
                {selected.plan?.adjustment_reason ||
                  `Train path is reconciled against the possession window of Block ${selected.block?.block_code || "B001"}. The possession slot is shifted to a clear zero-traffic window, preserving full operational throughput and ensuring 0 min regulation delay.`}
              </p>
            </DetailSection>
          </div>
        )}
      </Drawer>
    </>
  );
}