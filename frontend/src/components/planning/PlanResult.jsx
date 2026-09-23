import { useMemo } from "react";
import MegaBlockCard from "./MegaBlockCard";
import { formatScore } from "../../utils/formatters";

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default function PlanResult({ plan, onSelectPlan }) {
  const rawMb = plan?.mega_blocks ?? plan?.blocks ?? [];
  const planIds = useMemo(() => {
    if (Array.isArray(plan?.plan_ids) && plan.plan_ids.length > 0) {
      return plan.plan_ids.map(String);
    }
    const rawId = pick(plan, "plan_id", "id");
    if (rawId) {
      return String(rawId)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [plan]);

  const megaBlocks = useMemo(() => {
    return asArray(rawMb).map((mb, idx) => ({
      ...mb,
      plan_id: mb?.plan_id ?? planIds[idx] ?? mb?.id,
    }));
  }, [rawMb, planIds]);

  const scheduledTasks =
    pick(plan, "tasks_scheduled", "scheduled_task_count") ??
    (asArray(plan?.scheduled_tasks).length > 0 ? asArray(plan.scheduled_tasks).length : undefined) ??
    (asArray(plan?.plan_maintenance_tasks).length > 0 ? asArray(plan.plan_maintenance_tasks).length : undefined);

  const unscheduledTasks =
    pick(plan, "tasks_unscheduled", "unscheduled_task_count") ??
    (asArray(plan?.unscheduled_tasks).length > 0 ? asArray(plan.unscheduled_tasks).length : undefined);

  const affectedTrains =
    pick(plan, "affected_train_count", "affected_trains_count") ??
    (asArray(plan?.affected_trains).length > 0 ? asArray(plan.affected_trains).length : undefined) ??
    (asArray(plan?.train_impacts).length > 0 ? asArray(plan.train_impacts).length : undefined);

  const estimatedDelay = pick(plan, "estimated_delay_minutes", "expected_delay_minutes", "total_delay_minutes");

  return (
    <div className="stack">
      <section className="section-block">
        <div className="section-block__head">
          <h3>Generated Plan Overview</h3>
          <p className="text-xs text-faint">
            Summary metrics for the generated planning window. Click on any Plan ID or card to inspect full tasks and conflicts.
          </p>
        </div>
        <div className="plan-metrics">
          <div className="metric">
            <div className="metric__label">Plan ID(s)</div>
            {planIds.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 85, overflowY: "auto", padding: "2px 0" }}>
                {planIds.map((id) => (
                  <span
                    key={id}
                    className="plan-id-pill"
                    onClick={() => onSelectPlan && onSelectPlan(id)}
                    title={`Click to inspect Plan #${id}`}
                  >
                    #{id}
                  </span>
                ))}
              </div>
            ) : (
              <div className="metric__value mono">{pick(plan, "plan_id", "id") ?? "—"}</div>
            )}
          </div>

          <div className="metric metric--accent">
            <div className="metric__label">Optimization Score</div>
            <div className="metric__value">{pick(plan, "optimization_score") != null ? formatScore(plan.optimization_score) : "—"}</div>
          </div>

          <div className="metric">
            <div className="metric__label">Asset Availability Score</div>
            <div className="metric__value">{pick(plan, "asset_availability_score") != null ? formatScore(plan.asset_availability_score) : "—"}</div>
          </div>

          <div className="metric">
            <div className="metric__label">Tasks Scheduled</div>
            <div className="metric__value">{scheduledTasks ?? "—"}</div>
          </div>

          <div className="metric">
            <div className="metric__label">Tasks Unscheduled</div>
            <div className="metric__value">{unscheduledTasks ?? "—"}</div>
          </div>

          <div
            className="metric is-interactive"
            onClick={() => {
              const el = document.getElementById("mega-blocks-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            title="Click to jump to Mega Blocks section"
          >
            <div className="metric__label">Mega Blocks</div>
            <div className="metric__value" style={{ color: "var(--accent)" }}>{megaBlocks.length || "—"}</div>
          </div>

          <div className="metric">
            <div className="metric__label">Affected Trains</div>
            <div className="metric__value">{affectedTrains ?? "—"}</div>
          </div>

          <div className="metric">
            <div className="metric__label">Estimated Delay</div>
            <div className="metric__value">{estimatedDelay != null ? `${formatScore(estimatedDelay, 0)} min` : "—"}</div>
          </div>
        </div>
      </section>

      <section className="section-block" id="mega-blocks-section">
        <div className="section-block__head">
          <h3>Generated Mega Blocks ({megaBlocks.length})</h3>
          <p className="text-xs text-faint">
            Coordinated multi-department track possessions. Click on any card to inspect complete task assignments, train impacts, and conflicts.
          </p>
        </div>

        <div className="card__body" style={{ padding: 0 }}>
          {megaBlocks.length === 0 ? (
            <div className="state state--empty">
              The plan did not include any mega blocks.
            </div>
          ) : (
            <div className="stack" style={{ padding: "16px 0" }}>
              {megaBlocks.map((mb, index) => (
                <MegaBlockCard
                  key={index}
                  mb={mb}
                  onSelectPlan={onSelectPlan}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}