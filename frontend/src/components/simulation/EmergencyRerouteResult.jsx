import { useState } from "react";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { formatDateTime } from "../../utils/formatters";
import { ShieldAlert, Train, ArrowRight, CheckCircle2, AlertTriangle, Clock, MapPin, Zap, RefreshCw, Map as MapIcon, ExternalLink } from "lucide-react";
import { navigate } from "../../hooks/useRoute";
import TrackSchematicMap from "./TrackSchematicMap";

export default function EmergencyRerouteResult({ result }) {
  const [selectedStrategies, setSelectedStrategies] = useState({});
  const [dispatchedOrders, setDispatchedOrders] = useState({});

  if (!result || !result.reroute_plans) {
    return null;
  }

  const { emergency_event, metrics, reroute_plans } = result;

  function getActiveStrategy(trainId, defaultStrategyId) {
    return selectedStrategies[trainId] || defaultStrategyId;
  }

  function handleSelectStrategy(trainId, strategyId) {
    setSelectedStrategies((prev) => ({ ...prev, [trainId]: strategyId }));
  }

  function handleDispatch(trainNumber, strategyName) {
    setDispatchedOrders((prev) => ({ ...prev, [trainNumber]: true }));
  }

  return (
    <div className="stack" style={{ gap: 24, marginTop: 24 }}>
      {/* Emergency Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(15, 23, 42, 0.8))",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 4px 20px rgba(239, 68, 68, 0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert color="#ef4444" size={24} />
              <h2 style={{ margin: 0, fontSize: 18, color: "#fca5a5" }}>
                Emergency Track Block Active — Immediate Rerouting Intelligence
              </h2>
            </div>
            <p style={{ margin: "6px 0 0", color: "var(--text-2)", fontSize: 13 }}>
              Immediate track possession on <strong>Block {emergency_event?.block_code}</strong> ({emergency_event?.reason?.replace(/_/g, " ")}) for <strong>{emergency_event?.closure_duration_minutes} minutes</strong>.
            </p>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div>
              <span style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 1 }}>Window Closure</span>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#ef4444" }}>
                {formatDateTime(emergency_event?.closure_start)} → {formatDateTime(emergency_event?.closure_end)}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/map")}
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                borderColor: "rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                marginTop: 2,
              }}
            >
              <MapIcon size={14} style={{ marginRight: 6 }} />
              Open Live Railway Map
            </Button>
          </div>
        </div>

        {/* Metrics Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "10px 14px", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Affected Trains</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc", marginTop: 2 }}>
              {metrics?.affected_trains_count}
            </div>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "10px 14px", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>High-Priority VIP Services</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#38bdf8", marginTop: 2 }}>
              {metrics?.vip_trains_count} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-3)" }}>(Vande Bharat / Rajdhani)</span>
            </div>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "10px 14px", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Avg Stoppage Preservation</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e", marginTop: 2 }}>
              {metrics?.average_stoppage_preservation_pct}
            </div>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "10px 14px", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Parallel Line SLW Working</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#a855f7", marginTop: 4 }}>
              AVAILABLE (Bi-directional)
            </div>
          </div>
        </div>
      </div>

      {/* Reroute Options Header */}
      <div>
        <h3 style={{ fontSize: 16, margin: "0 0 6px" }}>
          Train-by-Train Rerouting Plans & Stoppage Maximization
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>
          The algorithm prioritizes commercial passenger stoppages to ensure passengers are not stranded, while minimizing transit delays.
        </p>
      </div>

      {/* Train Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {reroute_plans.map((t) => {
          const activeStratId = getActiveStrategy(t.train_id, t.recommended_strategy);
          const activeStrat = t.strategies.find((s) => s.id === activeStratId) || t.strategies[0];
          const isDispatched = dispatchedOrders[t.train_number];

          return (
            <div
              key={t.train_id}
              style={{
                background: "var(--surface)",
                border: t.is_vip ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid var(--border)",
                borderRadius: 12,
                padding: 18,
                position: "relative",
              }}
            >
              {/* Train Title & VIP Tag */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Train size={18} color={t.is_vip ? "#38bdf8" : "var(--text-2)"} />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc" }}>
                      {t.train_number} — {t.train_name}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-3)" }}>
                      ({t.train_type})
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {t.is_vip && (
                    <Badge tone="blue" dot>Priority 1 (VIP / Fast Path)</Badge>
                  )}
                  <Badge tone={activeStrat.preservation_pct === 100 ? "green" : "amber"}>
                    {activeStrat.preservation_pct}% Stops Preserved
                  </Badge>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>
                    +{activeStrat.estimated_delay_minutes} min delay
                  </span>
                </div>
              </div>

              {/* Rationale Banner */}
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.5)",
                  borderLeft: "3px solid #38bdf8",
                  padding: "8px 12px",
                  borderRadius: "0 6px 6px 0",
                  marginTop: 12,
                  fontSize: 12,
                  color: "var(--text-2)",
                }}
              >
                <strong>AI Dispatch Advice:</strong> {t.recommendation_rationale}
              </div>

              {/* Strategy Selector Tabs */}
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                {t.strategies.map((s) => {
                  const isSelected = s.id === activeStratId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStrategy(t.train_id, s.id)}
                      style={{
                        flex: 1,
                        minWidth: 220,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: isSelected
                          ? "1.5px solid #38bdf8"
                          : s.is_recommended
                          ? "1px solid rgba(56, 189, 248, 0.3)"
                          : "1px solid var(--border)",
                        background: isSelected ? "rgba(56, 189, 248, 0.08)" : "var(--surface-2)",
                        color: isSelected ? "#f8fafc" : "var(--text-2)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                        {s.is_recommended && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
                        <span>Stops: <strong style={{ color: s.preservation_pct === 100 ? "#22c55e" : "#eab308" }}>{s.preservation_pct}%</strong></span>
                        <span>•</span>
                        <span>Delay: <strong>+{s.estimated_delay_minutes}m</strong></span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Strategy Detailed Breakdown */}
              <div
                style={{
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  padding: 14,
                  marginTop: 12,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#f8fafc" }}>
                      Active Selection: {activeStrat.name}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-3)" }}>
                      ({activeStrat.regulatory_rule})
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const params = new URLSearchParams({
                          trainId: t.train_id,
                          trainNumber: t.train_number,
                          block: emergency_event?.block_code || "B002",
                          strategy: activeStrat.id,
                          strategyName: activeStrat.name,
                          bypassed: (activeStrat.stops_bypassed || []).join(","),
                          served: (activeStrat.stops_served || []).join(","),
                        });
                        navigate(`/map?${params.toString()}`);
                      }}
                      style={{
                        background: "rgba(56, 189, 248, 0.12)",
                        borderColor: "rgba(56, 189, 248, 0.35)",
                        color: "#38bdf8",
                      }}
                    >
                      <MapIcon size={14} style={{ marginRight: 6 }} />
                      View on Railway Map
                    </Button>
                    <Button
                      variant={isDispatched ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleDispatch(t.train_number, activeStrat.name)}
                      disabled={isDispatched}
                    >
                      {isDispatched ? (
                        <>
                          <CheckCircle2 size={14} style={{ marginRight: 6 }} />
                          Reroute Order Transmitted
                        </>
                      ) : (
                        <>
                          <Zap size={14} style={{ marginRight: 6 }} />
                          Transmit Reroute Order to Station Master
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Stoppages visualization */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>
                    Commercial Stoppages Served ({activeStrat.stops_served.length} / {t.total_scheduled_stops}):
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {activeStrat.stops_served.map((station, idx) => (
                      <span
                        key={station}
                        style={{
                          background: "rgba(34, 197, 94, 0.15)",
                          color: "#4ade80",
                          border: "1px solid rgba(34, 197, 94, 0.3)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        ✓ {station}
                      </span>
                    ))}
                    {activeStrat.stops_bypassed.length > 0 && (
                      <span style={{ marginLeft: 6, color: "var(--text-3)", fontSize: 11 }}>
                        | Bypasses:
                      </span>
                    )}
                    {activeStrat.stops_bypassed.map((station) => (
                      <span
                        key={station}
                        style={{
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        ⚠ {station} (Bus Bridge Required)
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>
                  {activeStrat.description}
                </div>

                {/* Interactive Track Schematic & Reroute Path Diagram */}
                <TrackSchematicMap
                  train={t}
                  activeStrategy={activeStrat}
                  emergencyEvent={emergency_event}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
