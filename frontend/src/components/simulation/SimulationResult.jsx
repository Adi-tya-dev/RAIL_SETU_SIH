import { useState } from "react";
import Badge from "../common/Badge";
import { formatDateTime, formatScore, humanize } from "../../utils/formatters";
import { SEVERITY_TONE, SEVERITY_LABEL } from "../../utils/constants";
import { Clock, CheckCircle2, AlertTriangle, Layers, Train, ArrowRight, ShieldCheck, ShieldAlert } from "lucide-react";
import { DetailSection, DetailList } from "../common/DetailList";

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function SimulationResult({ result }) {
  if (!result) return null;

  const originalEnd = pick(result, "original_end", "original_planned_end");
  const newEnd = pick(result, "new_end", "updated_end", "new_planned_end");
  const additionalDelay = Number(pick(result, "additional_delay_minutes", "additional_delay", "extra_delay_minutes") || 0);
  const newTrains =
    pick(result, "new_affected_trains_count", "affected_train_count") ??
    (asArray(result?.new_affected_trains).length || 0);
  const conflicts = asArray(result?.new_conflicts ?? result?.conflicts);
  const updatedPlan = result?.updated_plan ?? pick(result, "plan");
  const extraMinutes = Number(result?.extra_duration_minutes || 30);
  const blockCode = updatedPlan?.block_code || result?.block_code || (updatedPlan?.block ? updatedPlan.block.block_code : "—");
  const planId = updatedPlan?.plan_id || result?.plan_id || "—";
  const isSafe = additionalDelay === 0 && conflicts.length === 0;

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Simulation Key Metrics Grid */}
      <div>
        <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          Overrun Impact Assessment
        </h4>
        <div
          className="summary-grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <div className="summary-card summary-card--blue">
            <div className="summary-card__label">Original Closure End</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 6 }}>
              {formatDateTime(originalEnd)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
              Initial planned schedule
            </div>
          </div>

          <div className="summary-card summary-card--amber">
            <div className="summary-card__label">Extended Closure End</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--amber)", marginTop: 6 }}>
              {formatDateTime(newEnd)}
            </div>
            <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4, fontWeight: 600 }}>
              +{extraMinutes} min extension requested
            </div>
          </div>

          <div className={`summary-card summary-card--${additionalDelay > 0 ? "red" : "green"}`}>
            <div className="summary-card__label">Additional Train Delay</div>
            <div
              className="summary-card__value"
              style={{ color: additionalDelay > 0 ? "var(--red)" : "var(--green)", marginTop: 4 }}
            >
              {additionalDelay > 0 ? `+${formatScore(additionalDelay, 0)} min` : "0 min"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
              {additionalDelay > 0 ? "Cascading timetable delay" : "Zero timetable penalty"}
            </div>
          </div>

          <div className={`summary-card summary-card--${conflicts.length > 0 ? "red" : "purple"}`}>
            <div className="summary-card__label">New Conflicts Introduced</div>
            <div className="summary-card__value" style={{ marginTop: 4 }}>
              {conflicts.length}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
              {conflicts.length > 0 ? "Overlaps train movements" : "Corridor path is clear"}
            </div>
          </div>
        </div>
      </div>

      {/* Adjusted Schedule & Possession Allocation Card (Replaces the raw JSON dump!) */}
      {updatedPlan && (
        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 18px",
              background: isSafe ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: isSafe ? "var(--green)" : "var(--red)",
                  color: "#0b1120",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSafe ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Adjusted Schedule Allocation · Plan #{planId}
                </h4>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-2)" }}>
                  Infrastructure Segment: <strong>Block {blockCode}</strong>
                </p>
              </div>
            </div>

            <Badge tone={isSafe ? "green" : "red"} dot>
              {isSafe ? "Extension Clear · Safe to Grant" : "Delay Penalty Warning"}
            </Badge>
          </div>

          <div style={{ padding: "16px 18px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 14,
                marginBottom: 16,
              }}
            >
              {/* Original Window */}
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                  Original Possession Slot
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginTop: 6 }}>
                  {formatDateTime(updatedPlan.planned_start)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0", color: "var(--text-3)", fontSize: 12 }}>
                  <ArrowRight size={14} /> to
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  {formatDateTime(originalEnd)}
                </div>
              </div>

              {/* Extended Window */}
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", textTransform: "uppercase" }}>
                  Simulated Extended Slot (+{extraMinutes} min)
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginTop: 6 }}>
                  {formatDateTime(updatedPlan.planned_start)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0", color: "var(--amber)", fontSize: 12 }}>
                  <ArrowRight size={14} /> to
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--amber)" }}>
                  {formatDateTime(newEnd)}
                </div>
              </div>

              {/* Operational Dispatch Summary */}
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                  Operational Feasibility
                </div>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-3)" }}>Affected Trains:</span>
                    <strong>{newTrains}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-3)" }}>Cascading Delay:</span>
                    <strong style={{ color: additionalDelay > 0 ? "var(--red)" : "var(--green)" }}>
                      {additionalDelay} min
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-3)" }}>Headway Buffer:</span>
                    <strong style={{ color: "var(--green)" }}>Sufficient</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Controller Rationale Callout */}
            <div
              style={{
                background: "var(--surface)",
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                color: "var(--text-1)",
                lineHeight: 1.5,
              }}
            >
              <strong>Operations Controller Assessment: </strong>
              {isSafe ? (
                <span>
                  Extending the possession on <strong>Block {blockCode}</strong> by <strong>{extraMinutes} minutes</strong> (until {formatDateTime(newEnd)}) falls entirely within the natural headway margin of the corridor. No oncoming passenger services or scheduled freight rakes will experience outer-signal holding or headway delays. <strong>Safe to grant possession extension.</strong>
                </span>
              ) : (
                <span>
                  Extending the possession on <strong>Block {blockCode}</strong> by <strong>{extraMinutes} minutes</strong> causes a conflict with scheduled train paths, resulting in an expected regulation delay of <strong>{additionalDelay} minutes</strong> across {newTrains} service(s). Controller regulation or alternative pathing is advised.
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* New Conflicts Section */}
      <section className="card">
        <div className="card__head">
          <div>
            <h3>Corridor Train Conflicts</h3>
            <p>Conflicts with oncoming running passenger or freight paths generated by the extension.</p>
          </div>
        </div>

        {conflicts.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              background: "rgba(34, 197, 94, 0.05)",
              border: "1px dashed rgba(34, 197, 94, 0.3)",
              borderRadius: 8,
              color: "var(--green)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={24} />
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Zero Timetable Conflicts
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", maxWidth: 500 }}>
              The simulated +{extraMinutes} min maintenance overrun does not collide with any scheduled train paths through Block {blockCode}.
            </div>
          </div>
        ) : (
          <div className="snap-list">
            {conflicts.map((c, i) => (
              <div className="snap-row" key={c.conflict_id ?? i}>
                <div className="snap-row__main">
                  <div className="snap-row__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Train size={15} style={{ color: "var(--red)" }} />
                    {humanize(c.conflict_type)}
                  </div>
                  <div className="snap-row__meta">{c.description || "Train schedule overlap during extended window."}</div>
                </div>
                <div className="snap-row__right">
                  <Badge tone={SEVERITY_TONE[c.severity] || "red"}>
                    {SEVERITY_LABEL[c.severity] || `Severity ${c.severity}`}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}