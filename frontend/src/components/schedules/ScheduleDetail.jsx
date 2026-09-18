import { useEffect, useState } from "react";
import { getSchedule } from "../../api/schedules.api";
import { useApi } from "../../hooks/useApi";
import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import MegaBlockCard from "../planning/MegaBlockCard";
import { DetailList, DetailSection } from "../common/DetailList";
import { humanize, formatDateTime, formatScore, formatDuration } from "../../utils/formatters";
import { statusTone, SEVERITY_TONE, SEVERITY_LABEL, LEVEL_LABEL, PRIORITY_TONE } from "../../utils/constants";

const TABS = ["Overview", "Tasks", "Train Impacts", "Conflicts", "Operations", "Metrics"];

export default function ScheduleDetail({ planId, onClose }) {
  const { data, loading, error, run } = useApi();
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    if (planId) {
      setTab("Overview");
      run(() => getSchedule(planId));
    }
  }, [planId, run]);

  if (!planId) return null;

  const plan = data?.plan;
  const tasks = data?.maintenance_tasks || [];
  const impacts = data?.train_impacts || [];
  const conflicts = data?.conflicts || [];
  const operations = data?.operations || [];
  const departments = data?.departments || [];

  return (
    <Drawer
      open={Boolean(planId)}
      onClose={onClose}
      width="min(760px, 100vw)"
      title={`Plan ${planId}`}
      subtitle={plan?.block?.block_code ? `Block ${plan.block.block_code}` : "Generated schedule"}
      footer={<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}
    >
      {loading && (
        <div className="state state--loading" role="status">
          <span className="spinner" />
          <p>Loading plan details…</p>
        </div>
      )}

      {error && (
        <div className="state state--error" role="alert">
          <p className="state__title">Unable to load plan details</p>
          <p>{error.message}</p>
          <Button size="sm" onClick={() => run(() => getSchedule(planId))}>Retry</Button>
        </div>
      )}

      {data && (
        <>
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`tab ${tab === t ? "is-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Overview" && <Overview plan={plan} departments={departments} />}
          {tab === "Tasks" && <TasksTab tasks={tasks} />}
          {tab === "Train Impacts" && <ImpactsTab impacts={impacts} />}
          {tab === "Conflicts" && <ConflictsTab conflicts={conflicts} />}
          {tab === "Operations" && <OperationsTab operations={operations} />}
          {tab === "Metrics" && <MetricsTab plan={plan} />}
        </>
      )}
    </Drawer>
  );
}

function Overview({ plan, departments }) {
  if (!plan) return <div className="state state--empty">No plan data.</div>;
  return (
    <div className="stack">
      <DetailSection title="Plan Details">
        <DetailList
          items={[
            { label: "Plan ID", value: plan.plan_id },
            { label: "Block", value: plan.block?.block_code || "—" },
            { label: "Status", value: <Badge tone={statusTone(plan.status)} dot>{plan.status}</Badge> },
            { label: "Section", value: plan.block?.track?.section?.section_code || "—" },
            { label: "Track", value: plan.block?.track?.track_code || "—" },
            { label: "Created", value: formatDateTime(plan.created_at) },
          ]}
        />
      </DetailSection>

      <DetailSection title="Window">
        <DetailList
          items={[
            { label: "Planned Start", value: formatDateTime(plan.planned_start) },
            { label: "Planned End", value: formatDateTime(plan.planned_end) },
            { label: "Affected Trains", value: plan.affected_train_count ?? 0 },
            { label: "Expected Delay", value: `${formatScore(plan.expected_delay_minutes, 0)} min` },
          ]}
        />
      </DetailSection>

      {departments.length > 0 && (
        <DetailSection title="Departments">
          <div className="pill-list">
            {departments.map((d) => (
              <Badge key={d} tone="blue">{humanize(d)}</Badge>
            ))}
          </div>
        </DetailSection>
      )}

      {Array.isArray(plan.mega_blocks) && plan.mega_blocks.length > 0 && (
        <DetailSection title="Mega Blocks">
          <div className="stack">
            {plan.mega_blocks.map((mb, index) => (
              <MegaBlockCard key={index} mb={mb} />
            ))}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

function TasksTab({ tasks }) {
  if (tasks.length === 0) return <div className="state state--empty">No maintenance tasks linked to this plan.</div>;
  return (
    <div className="snap-list">
      {tasks.map((link) => {
        const task = link.maintenance_task || {};
        return (
          <div className="snap-row" key={String(link.plan_maintenance_task_id)}>
            <div className="snap-row__main">
              <div className="snap-row__title">
                #{task.maintenance_task_id} · {humanize(task.maintenance_type)}
              </div>
              <div className="snap-row__meta">
                {task.department} · {task.asset?.asset_code || "No asset"} · {formatDuration(task.duration_minutes)}
              </div>
            </div>
            <div className="snap-row__right">
              <div className="pill-list">
                <Badge tone={PRIORITY_TONE[task.priority]}>{LEVEL_LABEL[task.priority]}</Badge>
                {task.criticality != null && <Badge tone="gray">Crit {task.criticality}</Badge>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImpactsTab({ impacts }) {
  if (impacts.length === 0) return <div className="state state--empty">No train impacts recorded.</div>;
  return (
    <div className="snap-list">
      {impacts.map((impact) => (
        <div className="snap-row" key={String(impact.impact_id)}>
          <div className="snap-row__main">
            <div className="snap-row__title">
              {impact.train?.train_number || "—"} · {impact.train?.train_name || "Unknown train"}
            </div>
            <div className="snap-row__meta">{humanize(impact.impact_type) || "Impact"}</div>
          </div>
          <div className="snap-row__right">{formatScore(impact.estimated_delay_minutes, 0)} min delay</div>
        </div>
      ))}
    </div>
  );
}

function ConflictsTab({ conflicts }) {
  if (conflicts.length === 0) return <div className="state state--empty">No conflicts recorded for this plan.</div>;
  return (
    <div className="snap-list">
      {conflicts.map((conflict) => (
        <div className="snap-row" key={String(conflict.conflict_id)}>
          <div className="snap-row__main">
            <div className="snap-row__title">{humanize(conflict.conflict_type)}</div>
            <div className="snap-row__meta">
              {conflict.train ? `Train ${conflict.train.train_number}` : "No train"} ·{" "}
              {conflict.description || "No description"}
            </div>
          </div>
          <div className="snap-row__right">
            <div className="pill-list">
              <Badge tone={SEVERITY_TONE[conflict.severity]}>{SEVERITY_LABEL[conflict.severity]}</Badge>
              <Badge tone={conflict.resolved ? "green" : "red"} dot>{conflict.resolved ? "Resolved" : "Open"}</Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OperationsTab({ operations }) {
  if (operations.length === 0) return <div className="state state--empty">No operations recorded yet.</div>;
  return (
    <div className="snap-list">
      {operations.map((op) => (
        <div className="snap-row" key={String(op.operation_id)}>
          <div className="snap-row__main">
            <div className="snap-row__title">{humanize(op.completion_status) || "Operation"}</div>
            <div className="snap-row__meta">
              {formatDateTime(op.actual_start)} → {formatDateTime(op.actual_end)}
            </div>
          </div>
          <div className="snap-row__right">
            {op.actual_delay_minutes != null ? `${formatScore(op.actual_delay_minutes, 0)} min` : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricsTab({ plan }) {
  if (!plan) return <div className="state state--empty">No metrics available.</div>;
  const metrics = [
    { label: "Optimization Score", value: formatScore(plan.optimization_score), accent: true },
    { label: "Asset Availability Score", value: formatScore(plan.asset_availability_score) },
    { label: "Affected Trains", value: plan.affected_train_count ?? "—" },
    { label: "Expected Delay", value: `${formatScore(plan.expected_delay_minutes, 0)} min` },
  ];
  return (
    <div className="plan-metrics" style={{ borderTop: "none", padding: 0 }}>
      {metrics.map((m) => (
        <div className={`metric ${m.accent ? "metric--accent" : ""}`} key={m.label}>
          <div className="metric__label">{m.label}</div>
          <div className="metric__value">{m.value}</div>
        </div>
      ))}
    </div>
  );
}