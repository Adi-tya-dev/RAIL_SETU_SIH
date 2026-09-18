import MegaBlockCard from "./MegaBlockCard";
import { formatScore } from "../../utils/formatters";

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function PlanResult({ plan }) {
  const mb = plan?.mega_blocks ?? plan?.blocks ?? [];
  const megaBlocks = asArray(mb);

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

  const metrics = [
    { label: "Plan ID", value: pick(plan, "plan_id", "id") ?? "—", accent: false, mono: true },
    { label: "Optimization Score", value: pick(plan, "optimization_score") != null ? formatScore(plan.optimization_score) : "—", accent: true },
    { label: "Asset Availability Score", value: pick(plan, "asset_availability_score") != null ? formatScore(plan.asset_availability_score) : "—", accent: false },
    { label: "Tasks Scheduled", value: scheduledTasks ?? "—", accent: false },
    { label: "Tasks Unscheduled", value: unscheduledTasks ?? "—", accent: false },
    { label: "Mega Blocks", value: megaBlocks.length || "—", accent: false },
    { label: "Affected Trains", value: affectedTrains ?? "—", accent: false },
    { label: "Estimated Delay", value: estimatedDelay != null ? `${formatScore(estimatedDelay, 0)} min` : "—", accent: false },
  ];

  return (
    <div className="stack">
      <section className="section-block">
        <div className="section-block__head">
          <h3>Generated Plan</h3>
        </div>
        <div className="plan-metrics">
          {metrics.map((metric) => (
            <div className={`metric ${metric.accent ? "metric--accent" : ""}`} key={metric.label}>
              <div className="metric__label">{metric.label}</div>
              <div className={`metric__value ${metric.mono ? "mono" : ""}`}>{metric.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-block__head">
          <h3>Mega Blocks</h3>
        </div>
        <div className="card__body">
          {megaBlocks.length === 0 ? (
            <div className="state state--empty">
              The plan did not include any mega blocks.
            </div>
          ) : (
            <div className="stack">
              {megaBlocks.map((mb, index) => (
                <MegaBlockCard key={index} mb={mb} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}