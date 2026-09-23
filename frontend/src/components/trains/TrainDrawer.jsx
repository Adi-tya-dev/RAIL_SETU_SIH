import { useEffect, useState } from "react";
import { getTrain } from "../../api/trains.api";
import { listTrainImpacts } from "../../api/trainImpacts.api";
import { useApi } from "../../hooks/useApi";
import { navigate } from "../../hooks/useRoute";
import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { DetailList, DetailSection } from "../common/DetailList";
import { formatDateTime, formatDuration } from "../../utils/formatters";
import { statusTone, trainPriorityBadge } from "../../utils/constants";
import {
  MapPin,
  ExternalLink,
  Clock,
  AlertTriangle,
  Route,
  Activity,
  Layers,
  Calendar,
  CheckCircle2,
} from "lucide-react";

const TABS = ["Overview", "Route & Halts", "Block Movements", "Maintenance Impacts"];

export default function TrainDrawer({ train, onClose }) {
  const { data, loading, error, run } = useApi();
  const { data: impactsData, loading: loadingImpacts, run: runImpacts } = useApi();
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    if (train?.train_id) {
      setTab("Overview");
      run(() => getTrain(train.train_id));
      runImpacts(() => listTrainImpacts({ train_id: train.train_id }));
    }
  }, [train?.train_id, run, runImpacts]);

  if (!train) return null;

  // Unwrap payload safely, falling back to passed train row so basic info is never empty
  const trainDetail = data?.data || data || {};
  const trainData = { ...train, ...trainDetail };

  const routes = trainData.train_routes || [];
  const movements = trainData.train_block_movements || [];
  const impacts = impactsData?.data || [];

  const originStation =
    trainData.origin_station?.station_code
      ? `${trainData.origin_station.station_code} · ${trainData.origin_station.station_name || "Origin"}`
      : train.origin_station?.station_code || "—";

  const destStation =
    trainData.destination_station?.station_code
      ? `${trainData.destination_station.station_code} · ${trainData.destination_station.station_name || "Destination"}`
      : train.destination_station?.station_code || "—";

  const priorityMeta = trainPriorityBadge(trainData.priority);

  return (
    <Drawer
      open={Boolean(train)}
      onClose={onClose}
      width="min(680px, 100vw)"
      title={`${trainData.train_number || train.train_number} — ${trainData.train_name || train.train_name}`}
      subtitle={`${trainData.train_type || "Express"} · Priority ${trainData.priority ?? 1}`}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/map?trainId=${trainData.train_id}&trainNumber=${trainData.train_number}`);
              }}
            >
              <MapPin size={13} style={{ marginRight: 6 }} />
              Live Map
            </Button>
            {impacts.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/map?trainId=${trainData.train_id}&trainNumber=${trainData.train_number}&conflict=true`);
                  }}
                  style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
                >
                  <AlertTriangle size={13} style={{ marginRight: 6, color: "#ef4444" }} />
                  View Map Conflict
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/train-impacts?trainId=${trainData.train_id}&trainNumber=${trainData.train_number}`);
                  }}
                >
                  <ExternalLink size={13} style={{ marginRight: 6 }} />
                  View Impacts
                </Button>
              </>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {/* Quick Summary Pill Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <Badge tone={priorityMeta.tone}>{priorityMeta.label}</Badge>
        <Badge tone={statusTone(trainData.status)} dot>
          {trainData.status || "ACTIVE"}
        </Badge>
        <span style={{ fontSize: 12, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
          <Route size={13} /> {originStation} → {destStation}
        </span>
      </div>

      {loading && !data && (
        <div className="state state--loading" role="status" style={{ padding: "20px 0" }}>
          <span className="spinner" />
          <p>Loading full train details & movement schedules…</p>
        </div>
      )}

      {error && !data && (
        <div className="state state--error" role="alert" style={{ marginBottom: 16 }}>
          <p className="state__title">Unable to load full route details</p>
          <p>{error.message}</p>
          <Button size="sm" onClick={() => run(() => getTrain(train.train_id))}>
            Retry
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {TABS.map((t) => {
          let count = null;
          if (t === "Route & Halts") count = routes.length;
          if (t === "Block Movements") count = movements.length;
          if (t === "Maintenance Impacts") count = impacts.length;

          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`tab ${tab === t ? "is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              {count !== null && count > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: t === "Maintenance Impacts" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.12)",
                    color: t === "Maintenance Impacts" ? "#ef4444" : "inherit",
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {tab === "Overview" && (
        <div className="stack" style={{ gap: 16 }}>
          <DetailSection title="Train Information">
            <DetailList
              items={[
                { label: "Train Number", value: <span className="mono cell-strong">{trainData.train_number}</span> },
                { label: "Train Name", value: trainData.train_name },
                { label: "Service Type", value: trainData.train_type || "Standard" },
                {
                  label: "Priority Class",
                  value: <Badge tone={priorityMeta.tone}>{priorityMeta.label}</Badge>,
                },
                {
                  label: "Operational Status",
                  value: <Badge tone={statusTone(trainData.status)} dot>{trainData.status || "ACTIVE"}</Badge>,
                },
                { label: "Origin Station", value: originStation },
                { label: "Destination Station", value: destStation },
              ]}
            />
          </DetailSection>

          <DetailSection title="Corridor Metrics">
            <div className="plan-metrics" style={{ borderTop: "none", paddingTop: 0 }}>
              <div className="metric">
                <span className="metric__label">Scheduled Stops</span>
                <span className="metric__value">{routes.length}</span>
              </div>
              <div className="metric">
                <span className="metric__label">Blocks Traversed</span>
                <span className="metric__value">{movements.length}</span>
              </div>
              <div className="metric">
                <span className="metric__label">Active Possession Impacts</span>
                <span className="metric__value" style={{ color: impacts.length > 0 ? "#ef4444" : "var(--green)" }}>
                  {impacts.length}
                </span>
              </div>
            </div>
          </DetailSection>

          {/* Quick Route Preview */}
          <DetailSection title="Route Path Preview">
            {routes.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>
                {loading ? "Loading route stops…" : "No route stops recorded."}
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "6px 8px",
                  padding: "12px",
                  borderRadius: 10,
                  background: "var(--surface)",
                  border: "1px solid var(--border-2)",
                }}
              >
                {routes.map((r, i) => (
                  <span
                    key={r.train_route_id || i}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        background:
                          i === 0
                            ? "var(--blue-dim, rgba(59,130,246,0.15))"
                            : i === routes.length - 1
                            ? "var(--green-dim, rgba(34,197,94,0.15))"
                            : "var(--surface-2)",
                        color:
                          i === 0
                            ? "var(--blue, #3b82f6)"
                            : i === routes.length - 1
                            ? "var(--green, #22c55e)"
                            : "var(--text-2)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {r.station?.station_code || r.station_id || `Stop ${i + 1}`}
                    </span>
                    {i < routes.length - 1 && <span style={{ color: "var(--text-4)" }}>→</span>}
                  </span>
                ))}
              </div>
            )}
          </DetailSection>
        </div>
      )}

      {/* Tab 2: Route & Halts */}
      {tab === "Route & Halts" && (
        <DetailSection title={`Scheduled Station Halts (${routes.length})`}>
          {routes.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>
              {loading ? "Loading route stops…" : "No route data available for this train."}
            </p>
          ) : (
            <div className="snap-list">
              {routes.map((route, idx) => {
                const isOrigin = idx === 0;
                const isDest = idx === routes.length - 1;
                return (
                  <div className="snap-row" key={String(route.train_route_id || idx)}>
                    <div className="snap-row__main">
                      <div className="snap-row__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: isOrigin
                              ? "var(--blue, #3b82f6)"
                              : isDest
                              ? "var(--green, #22c55e)"
                              : "var(--surface-2)",
                            color: isOrigin || isDest ? "#fff" : "var(--text-3)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {route.sequence_number || idx + 1}
                        </span>
                        <span className="mono" style={{ fontWeight: 700 }}>
                          {route.station?.station_code || "—"}
                        </span>
                        <span>· {route.station?.station_name || "Station"}</span>
                        {isOrigin && <Badge tone="blue">ORIGIN</Badge>}
                        {isDest && <Badge tone="green">DESTINATION</Badge>}
                      </div>
                      <div className="snap-row__meta" style={{ paddingLeft: 30 }}>
                        {route.station?.section_id ? `Section ${route.station.section_id}` : ""}
                        {route.scheduled_arrival && route.scheduled_departure && (
                          <span> · Halt duration: scheduled</span>
                        )}
                      </div>
                    </div>
                    <div className="snap-row__right">
                      {route.scheduled_arrival ? (
                        <div>Arr: {formatDateTime(route.scheduled_arrival)}</div>
                      ) : (
                        <div style={{ color: "var(--text-4)" }}>Origin Depot</div>
                      )}
                      {route.scheduled_departure ? (
                        <div style={{ color: "var(--accent)" }}>Dep: {formatDateTime(route.scheduled_departure)}</div>
                      ) : (
                        <div style={{ color: "var(--text-4)" }}>Terminus</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DetailSection>
      )}

      {/* Tab 3: Block Movements */}
      {tab === "Block Movements" && (
        <DetailSection title={`Block Possession & Traversals (${movements.length})`}>
          {movements.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>
              {loading ? "Loading corridor movements…" : "No block movements recorded for this train service."}
            </p>
          ) : (
            <div className="snap-list">
              {movements.map((m, idx) => (
                <div className="snap-row" key={String(m.movement_id || idx)}>
                  <div className="snap-row__main">
                    <div className="snap-row__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Layers size={14} style={{ color: "var(--accent)" }} />
                      <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>
                        Block {m.block?.block_code || m.block_id || "—"}
                      </span>
                      {m.block?.status && (
                        <Badge tone={statusTone(m.block.status)} dot>
                          {m.block.status}
                        </Badge>
                      )}
                    </div>
                    <div className="snap-row__meta">
                      {m.block?.track?.track_name || m.block?.track?.track_code
                        ? `Track: ${m.block.track.track_name || m.block.track.track_code}`
                        : "Corridor Segment"}
                    </div>
                  </div>
                  <div className="snap-row__right">
                    <div>Entry: {formatDateTime(m.scheduled_entry)}</div>
                    <div style={{ color: "var(--text-4)" }}>Exit: {formatDateTime(m.scheduled_exit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}

      {/* Tab 4: Maintenance Impacts */}
      {tab === "Maintenance Impacts" && (
        <DetailSection title={`Associated Maintenance Block Possessions (${impacts.length})`}>
          {loadingImpacts && (
            <div className="state state--loading" role="status" style={{ padding: "16px 0" }}>
              <span className="spinner" />
              <p>Checking schedule conflicts & possession impacts…</p>
            </div>
          )}

          {!loadingImpacts && impacts.length === 0 && (
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                background: "var(--surface)",
                border: "1px solid var(--border-2)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <CheckCircle2 size={24} style={{ color: "var(--green)" }} />
              <div>
                <div style={{ fontWeight: 700, color: "var(--text-1)", fontSize: 14 }}>
                  No Maintenance Conflicts Detected
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  This train's operational path runs clear with no planned possessions or speed restrictions.
                </div>
              </div>
            </div>
          )}

          {!loadingImpacts && impacts.length > 0 && (
            <div className="snap-list">
              {impacts.map((imp, idx) => (
                <div
                  key={imp.impact_id || `${imp.plan_id}-${idx}`}
                  className="snap-row"
                  style={{
                    borderLeft: "3px solid #ef4444",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertTriangle size={15} style={{ color: "#ef4444" }} />
                      <span className="mono" style={{ fontWeight: 700 }}>
                        Plan #{imp.plan_id}
                      </span>
                      <Badge tone="red">{imp.impact_type || "POSSESSION_OVERLAP"}</Badge>
                    </div>
                    {imp.estimated_delay_minutes != null && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>
                        Delay: +{imp.estimated_delay_minutes} min
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    <strong>Affected Block:</strong>{" "}
                    <span className="mono">{imp.block?.block_code || imp.plan?.block?.block_code || "—"}</span>
                    {imp.plan?.planned_start && (
                      <span>
                        {" "}· Window: {formatDateTime(imp.plan.planned_start)} → {formatDateTime(imp.plan.planned_end)}
                      </span>
                    )}
                  </div>

                  {imp.plan?.adjustment_reason && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--text-2)",
                        background: "var(--surface-2)",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                      }}
                    >
                      {imp.plan.adjustment_reason}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        navigate(`/map?trainId=${trainData.train_id}&trainNumber=${trainData.train_number}&block=${imp.block?.block_code || imp.plan?.block?.block_code || ""}&conflict=true`);
                      }}
                      style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444", fontSize: 11 }}
                    >
                      <MapPin size={12} style={{ marginRight: 4 }} />
                      View on Map
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}
    </Drawer>
  );
}