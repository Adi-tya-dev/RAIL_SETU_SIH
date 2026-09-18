import Badge from "../common/Badge";
import { formatDateTime, formatScore, humanize } from "../../utils/formatters";
import { SEVERITY_TONE, SEVERITY_LABEL } from "../../utils/constants";

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
  const originalEnd = pick(result, "original_end", "original_planned_end");
  const newEnd = pick(result, "new_end", "updated_end", "new_planned_end");
  const additionalDelay = pick(result, "additional_delay_minutes", "additional_delay", "extra_delay_minutes");
  const newTrains =
    pick(result, "new_affected_trains_count", "affected_train_count") ??
    (asArray(result?.new_affected_trains).length || undefined);
  const conflicts = asArray(result?.new_conflicts ?? result?.conflicts);
  const updatedPlan = result?.updated_plan ?? pick(result, "plan");

  const metrics = [
    { label: "Original End", value: formatDateTime(originalEnd) },
    { label: "New End", value: formatDateTime(newEnd), accent: true },
    {
      label: "Additional Delay",
      value: additionalDelay != null ? `${formatScore(additionalDelay, 0)} min` : "—",
      accent: true,
    },
    { label: "New Affected Trains", value: newTrains ?? "—" },
    { label: "New Conflicts", value: conflicts.length },
  ];

  return (
    <div className="stack">
      <section className="section-block">
        <div className="section-block__head">
          <h3>Simulation Impact</h3>
        </div>
        <div className="plan-metrics">
          {metrics.map((m) => (
            <div className={`metric ${m.accent ? "metric--accent" : ""}`} key={m.label}>
              <div className="metric__label">{m.label}</div>
              <div className="metric__value">{m.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-block__head">
          <h3>New Conflicts</h3>
        </div>
        <div className="section-block__body">
          {conflicts.length === 0 ? (
            <div className="state state--empty">No new conflicts introduced by this change.</div>
          ) : (
            <div className="snap-list">
              {conflicts.map((c, i) => (
                <div className="snap-row" key={c.conflict_id ?? i}>
                  <div className="snap-row__main">
                    <div className="snap-row__title">{humanize(c.conflict_type)}</div>
                    <div className="snap-row__meta">{c.description || "No description"}</div>
                  </div>
                  <div className="snap-row__right">
                    <Badge tone={SEVERITY_TONE[c.severity]}>{SEVERITY_LABEL[c.severity] || c.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {updatedPlan && (
        <section className="section-block">
          <div className="section-block__head">
            <h3>Updated Plan</h3>
          </div>
          <div className="section-block__body">
            <pre
              className="mono"
              style={{
                margin: 0,
                fontSize: 12,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--text-2)",
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              {JSON.stringify(updatedPlan, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}