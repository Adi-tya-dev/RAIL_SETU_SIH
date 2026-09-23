import Badge from "../common/Badge";
import Button from "../common/Button";
import { formatScore, formatDuration, formatTime, humanize } from "../../utils/formatters";
import { ArrowUpRight } from "lucide-react";

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

function computeDuration(mb, start, end) {
  const explicit = pick(mb, "duration_minutes", "duration");
  if (explicit !== undefined) return formatDuration(explicit);
  if (start && end) {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    if (Number.isFinite(diff) && diff >= 0) return formatDuration(diff);
  }
  return "—";
}

export default function MegaBlockCard({ mb, onSelectPlan }) {
  const planId = mb?.plan_id ?? mb?.id;
  const id = mb?.mega_block_id ?? mb?.mb_id ?? (planId ? `MB #${planId}` : "MB");
  const blockCode = mb?.block_code ?? mb?.block?.block_code ?? mb?.block ?? "—";
  const start = mb?.start ?? mb?.start_time ?? mb?.planned_start ?? mb?.time_window?.start;
  const end = mb?.end ?? mb?.end_time ?? mb?.planned_end ?? mb?.time_window?.end;

  const tasks =
    pick(mb, "task_count", "tasks_scheduled") ?? (Array.isArray(mb?.tasks) ? mb.tasks.length : undefined);
  const affectedTrains =
    pick(mb, "affected_train_count", "estimated_affected_trains") ??
    (Array.isArray(mb?.affected_trains) ? mb.affected_trains.length : undefined);
  const delay = pick(mb, "estimated_delay_minutes", "expected_delay_minutes", "delay_minutes");
  const reason = pick(mb, "reason", "rationale", "consolidation_reason");
  const departments = asArray(mb?.departments ?? mb?.department);

  const isClickable = Boolean(onSelectPlan && planId);

  return (
    <article
      className={`megablock ${isClickable ? "is-clickable" : ""}`}
      onClick={isClickable ? () => onSelectPlan(planId) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter") onSelectPlan(planId);
            }
          : undefined
      }
    >
      <header className="megablock__head">
        <div className="megablock__title-group">
          <span className="megablock__id">{id}</span>
          <Badge tone="amber">Block {blockCode}</Badge>
          <span className="megablock__time">
            {start ? formatTime(start) : "—"} → {end ? formatTime(end) : "—"}
          </span>
        </div>

        {isClickable && (
          <Button
            size="xs"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPlan(planId);
            }}
          >
            Inspect Plan <ArrowUpRight size={13} style={{ marginLeft: 2 }} />
          </Button>
        )}
      </header>

      <div className="megablock__body">
        <div className="metric">
          <div className="metric__label">Duration</div>
          <div className="metric__value">{computeDuration(mb, start, end)}</div>
        </div>
        <div className="metric">
          <div className="metric__label">Tasks</div>
          <div className="metric__value">{tasks ?? "—"}</div>
        </div>
        <div className="metric">
          <div className="metric__label">Affected Trains</div>
          <div className="metric__value">{affectedTrains ?? "—"}</div>
        </div>
        <div className="metric">
          <div className="metric__label">Estimated Delay</div>
          <div className="metric__value">{delay != null ? `${formatScore(delay, 0)} min` : "—"}</div>
        </div>
        <div className="metric metric--accent">
          <div className="metric__label">Optimization Score</div>
          <div className="metric__value">
            {mb?.optimization_score != null ? formatScore(mb.optimization_score) : "—"}
          </div>
        </div>
      </div>

      <div className="megablock__row">
        <span className="megablock__stat">
          <span>Departments</span>
          <b className="pill-list">
            {departments.length > 0
              ? departments.map((d, i) => <Badge key={i} tone="blue">{humanize(d)}</Badge>)
              : "—"}
          </b>
        </span>
        <span className="megablock__stat">
          <span>Block Section</span>
          <b className="mono">{blockCode}</b>
        </span>
      </div>

      {reason && (
        <div className="megablock__row" style={{ paddingTop: 0, borderTop: "none" }}>
          <div className="megablock__reason">
            <strong>Reason:</strong>{" "}
            {Array.isArray(reason) ? reason.join(" · ") : reason}
          </div>
        </div>
      )}
    </article>
  );
}