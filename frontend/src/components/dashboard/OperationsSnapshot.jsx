import { useCallback } from "react";
import { listMaintenance } from "../../api/maintenance.api";
import { listSchedules } from "../../api/schedules.api";
import { listConflicts } from "../../api/conflicts.api";
import { useApiQuery } from "../../hooks/useApi";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { humanize, formatDateTime, formatScore } from "../../utils/formatters";
import { statusTone, PRIORITY_TONE, LEVEL_LABEL } from "../../utils/constants";

function SnapRow({ title, meta, right }) {
  return (
    <div className="snap-row">
      <div className="snap-row__main">
        <div className="snap-row__title">{title}</div>
        <div className="snap-row__meta">{meta}</div>
      </div>
      <div className="snap-row__right">{right}</div>
    </div>
  );
}

function MiniList({ loading, error, rows = [], loadingMessage, emptyMessage, onRetry, renderRow }) {
  if (loading) {
    return (
      <div className="state state--loading" role="status">
        <span className="spinner" />
        <p>{loadingMessage}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="state state--error" role="alert">
        <p className="state__title">Unable to load</p>
        <p>{error.message}</p>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="state state--empty">{emptyMessage}</div>;
  }
  return <div className="snap-list">{rows.map(renderRow)}</div>;
}

function CriticalMaintenance() {
  const fetcher = useCallback(() => listMaintenance({ limit: 5, priority: 4 }), []);
  const { data, loading, error, reload } = useApiQuery(fetcher, []);
  const rows = data?.data || [];

  return (
    <section className="section-block">
      <div className="section-block__head">
        <h3>Critical Maintenance</h3>
      </div>
      <div className="section-block__body">
        <MiniList
          loading={loading}
          error={error}
          rows={rows}
          loadingMessage="Loading critical maintenance…"
          emptyMessage="No critical priority tasks found."
          onRetry={reload}
          renderRow={(task) => (
            <SnapRow
              key={String(task.maintenance_task_id)}
              title={humanize(task.maintenance_type)}
              meta={`${task.department || "—"} · ${task.block?.block_code || "No block"}`}
              right={
                <div className="pill-list">
                  <Badge tone={statusTone(task.status, "amber")}>{task.status}</Badge>
                  <Badge tone={PRIORITY_TONE[task.priority]}>{LEVEL_LABEL[task.priority]}</Badge>
                </div>
              }
            />
          )}
        />
      </div>
    </section>
  );
}

function RecentPlans() {
  const fetcher = useCallback(() => listSchedules({ limit: 5 }), []);
  const { data, loading, error, reload } = useApiQuery(fetcher, []);
  const rows = data?.data || [];

  return (
    <section className="section-block">
      <div className="section-block__head">
        <h3>Recent Plans</h3>
      </div>
      <div className="section-block__body">
        <MiniList
          loading={loading}
          error={error}
          rows={rows}
          loadingMessage="Loading recent plans…"
          emptyMessage="No generated schedules yet."
          onRetry={reload}
          renderRow={(plan) => (
            <SnapRow
              key={String(plan.plan_id)}
              title={`Plan ${plan.plan_id} — ${plan.block?.block_code || "N/A"}`}
              meta={formatDateTime(plan.planned_start)}
              right={
                <div className="pill-list">
                  <Badge tone={statusTone(plan.status, "amber")}>{plan.status}</Badge>
                  <Badge tone="blue">Score {formatScore(plan.optimization_score)}</Badge>
                </div>
              }
            />
          )}
        />
      </div>
    </section>
  );
}

function OpenConflicts() {
  const fetcher = useCallback(() => listConflicts({ limit: 100 }), []);
  const { data, loading, error, reload } = useApiQuery(fetcher, []);
  const conflicts = (data?.data || []).filter((conflict) => !conflict.resolved);
  return (
    <section className="section-block">
      <div className="section-block__head">
        <h3>Open Conflicts</h3>
      </div>
      <div className="section-block__body">
        <MiniList loading={loading} error={error} rows={conflicts.slice(0, 5)} loadingMessage="Loading conflicts…" emptyMessage="No open conflicts detected." onRetry={reload} renderRow={(conflict, index) => <SnapRow key={String(conflict.conflict_id || index)} title={conflict.description || "Schedule conflict"} meta={`Plan ${conflict.plan_id || "—"}`} right={<Badge tone={conflict.severity >= 4 ? "red" : "amber"}>{conflict.severity || "—"}</Badge>} />} />
      </div>
    </section>
  );
}

export default function OperationsSnapshot() {
  return (
    <div className="grid grid--3">
      <CriticalMaintenance />
      <RecentPlans />
      <OpenConflicts />
    </div>
  );
}