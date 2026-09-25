import { useEffect, useState, useMemo } from "react";
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

function formatResourceItem(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object") {
    if (item.designation) return item.designation;
    if (item.role && item.count) return `${item.count}x ${item.role}`;
    if (item.name && item.count) return `${item.count}x ${item.name}`;
    if (item.role) return item.role;
    if (item.name) return item.name;
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }
  return String(item);
}

export default function ScheduleDetail({ planId, planData, onClose }) {
  const { data, loading, error, run } = useApi();
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    if (planId) {
      setTab("Overview");
      run(() => getSchedule(planId));
    }
  }, [planId, run]);

  // Derive robust fallback from active planning result if available
  const fallbackPayload = useMemo(() => {
    if (!planData || !planId) return null;
    const mbList = planData.mega_blocks || planData.blocks || [];
    const mb =
      mbList.find(
        (m) =>
          String(m.plan_id) === String(planId) ||
          String(m.id) === String(planId) ||
          String(m.mega_block_id || "").includes(String(planId))
      ) || mbList[0];

    if (!mb) return null;

    const mbTasks =
      mb.tasks && mb.tasks.length > 0
        ? mb.tasks
        : (planData.scheduled_tasks || []).filter(
            (t) =>
              (mb.task_ids || []).includes(t.task_id || t.maintenance_task_id) ||
              String(t.block_id) === String(mb.block_id)
          );

    const mbImpacts =
      mb.affected_trains && mb.affected_trains.length > 0
        ? mb.affected_trains
        : (planData.train_impacts || []).filter(
            (imp) => String(imp.block_id) === String(mb.block_id)
          );

    const mbConflicts = (planData.conflicts || []).filter(
      (c) => String(c.block_id) === String(mb.block_id)
    );

    return {
      plan: {
        plan_id: planId,
        status: mb.status || "PROPOSED",
        planned_start: mb.planned_start || mb.start || mb.start_time,
        planned_end: mb.planned_end || mb.end || mb.end_time,
        optimization_score: mb.optimization_score ?? planData.optimization_score,
        asset_availability_score: mb.asset_availability_score ?? planData.asset_availability_score,
        affected_train_count: mb.affected_train_count ?? mbImpacts.length,
        expected_delay_minutes: mb.estimated_delay_minutes ?? mb.delay_minutes ?? 120,
        block: {
          block_id: mb.block_id,
          block_code: mb.block_code || `B00${mb.block_id || 1}`,
          track: { track_code: "UP Main", section: { section_code: "SEC-NDLS-GZB" } },
        },
        reason: mb.reason || "Coordinated multi-department maintenance block",
      },
      maintenance_tasks: mbTasks.map((t, idx) => ({
        plan_maintenance_task_id: idx + 1,
        maintenance_task: {
          maintenance_task_id: t.task_id || t.maintenance_task_id || idx + 1,
          task_code: t.task_code || `TASK-${t.task_id || idx + 1}`,
          description: t.description || t.maintenance_type || "Routine Maintenance",
          maintenance_type: t.maintenance_type || t.description || "TRACK_MAINTENANCE",
          department: t.department || (mb.departments && mb.departments[0]) || "Engineering",
          priority: t.priority || 2,
          criticality: t.criticality || 2,
          urgency: t.urgency || 2,
          duration_minutes: t.duration_minutes || 60,
          asset: t.asset || { asset_code: `AST-${idx + 1}`, asset_name: "Track Point & Crossings" },
        },
      })),
      train_impacts: mbImpacts.map((imp, idx) => ({
        impact_id: idx + 1,
        estimated_delay_minutes: imp.estimated_delay_minutes || imp.delay_minutes || 15,
        impact_type: imp.impact_type || "REGULATED",
        train: imp.train || {
          train_number: imp.train_number || "12301",
          train_name: imp.train_name || "Express Service",
          train_type: imp.train_type || "MAIL_EXPRESS",
        },
      })),
      conflicts: mbConflicts.map((c, idx) => ({
        conflict_id: idx + 1,
        conflict_type: c.conflict_type || "HEADWAY_VIOLATION",
        severity: c.severity || "MEDIUM",
        description: c.description || "Potential headway compression",
        train: c.train || { train_number: "12301", train_name: "Express" },
      })),
      operations: [],
      departments: mb.departments || ["Engineering", "Signal", "Traction"],
    };
  }, [planData, planId]);

  if (!planId) return null;

  const payload = data?.data || data || fallbackPayload;
  const plan = payload?.plan || (payload?.plan_id ? payload : null);
  const tasks = payload?.maintenance_tasks || payload?.plan_maintenance_tasks || [];
  const impacts = payload?.train_impacts || payload?.plan_train_impacts || [];
  const conflicts = payload?.conflicts || payload?.block_conflicts || [];
  const operations = payload?.operations || payload?.block_operations || [];
  const departments =
    payload?.departments && payload.departments.length > 0
      ? payload.departments
      : [...new Set(tasks.map((t) => t?.maintenance_task?.department).filter(Boolean))];

  const blockCode = plan?.block?.block_code;
  const trackCode = plan?.block?.track?.track_code;
  const sectionCode = plan?.block?.track?.section?.section_code;

  return (
    <Drawer
      open={Boolean(planId)}
      onClose={onClose}
      width="min(760px, 100vw)"
      title={plan ? `Plan ${planId} · ${plan.status || "SCHEDULE"}` : `Plan ${planId}`}
      subtitle={blockCode ? `Block ${blockCode}${sectionCode ? ` · ${sectionCode}` : ""}${trackCode ? ` (${trackCode})` : ""}` : "Generated schedule"}
      footer={<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}
    >
      {loading && !payload && (
        <div className="state state--loading" role="status">
          <span className="spinner" />
          <p>Loading plan details…</p>
        </div>
      )}

      {error && !payload && (
        <div className="state state--error" role="alert">
          <p className="state__title">Unable to load plan details</p>
          <p>{error.message}</p>
          <Button size="sm" onClick={() => run(() => getSchedule(planId))}>Retry</Button>
        </div>
      )}

      {payload && (
        <>
          <div className="tabs" role="tablist">
            {TABS.map((t) => {
              let count = null;
              if (t === "Tasks") count = tasks.length;
              if (t === "Train Impacts") count = impacts.length;
              if (t === "Conflicts") count = conflicts.length;
              if (t === "Operations") count = operations.length;

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
                    <span style={{ marginLeft: 6, fontSize: 11, padding: "1px 6px", borderRadius: 10, background: "rgba(255,255,255,0.15)" }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
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

  let resources = plan.resource_requirements;
  if (typeof resources === "string") {
    try {
      resources = JSON.parse(resources);
    } catch {
      resources = null;
    }
  }

  const isBlueprint = plan.status === "BLUEPRINT" || plan.plan_horizon === "MONTHLY";

  return (
    <div className="stack">
      <DetailSection title="Plan Details">
        <DetailList
          items={[
            { label: "Plan ID", value: plan.plan_id },
            { label: "Block", value: plan.block?.block_code || "—" },
            { label: "Status", value: <Badge tone={statusTone(plan.status)} dot>{plan.status}</Badge> },
            { label: "Section", value: plan.block?.track?.section?.section_code || plan.block?.track?.section?.section_name || "—" },
            { label: "Track", value: plan.block?.track?.track_code || plan.block?.track?.track_name || "—" },
            { label: "Created", value: formatDateTime(plan.created_at) },
          ]}
        />
      </DetailSection>

      {(isBlueprint || plan.work_package_code || plan.adjustment_reason) && (
        <DetailSection title="Strategic Horizon & Work Package">
          <DetailList
            items={[
              {
                label: "Planning Horizon",
                value: (
                  <Badge tone={isBlueprint ? "purple" : "blue"}>
                    {plan.plan_horizon === "MONTHLY" ? "30-Day Strategic Blueprint" : plan.plan_horizon || (isBlueprint ? "Blueprint Horizon" : "Operational")}
                  </Badge>
                ),
              },
              ...(plan.work_package_code ? [{ label: "Work Package", value: <span className="cell-mono cell-strong">{plan.work_package_code}</span> }] : []),
              ...(plan.original_window ? [{ label: "Original Window", value: plan.original_window }] : []),
              ...(plan.adjustment_reason ? [{ label: "Strategy Rationale", value: plan.adjustment_reason }] : []),
            ]}
          />
        </DetailSection>
      )}

      <DetailSection title="Window & Train Operational Impact">
        <DetailList
          items={[
            { label: "Planned Start", value: formatDateTime(plan.planned_start) },
            { label: "Planned End", value: formatDateTime(plan.planned_end) },
            { label: "Affected Trains", value: plan.affected_train_count ?? 0 },
            { label: "Expected Delay", value: `${formatScore(plan.expected_delay_minutes, 0)} min` },
          ]}
        />
      </DetailSection>

      {resources && (
        <DetailSection title="Allocated Machinery & Resources">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.isArray(resources.crews) && resources.crews.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Assigned Maintenance Gangs & Crews
                </div>
                <div className="pill-list">
                  {resources.crews.map((c, idx) => (
                    <Badge key={idx} tone="amber">{formatResourceItem(c)}</Badge>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(resources.machinery) && resources.machinery.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Heavy Track Machinery & On-Track Plants
                </div>
                <div className="pill-list">
                  {resources.machinery.map((m, idx) => (
                    <Badge key={idx} tone="purple">{formatResourceItem(m)}</Badge>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(resources.materials) && resources.materials.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Track Materials & Spares Allocated
                </div>
                <div className="pill-list">
                  {resources.materials.map((mat, idx) => (
                    <Badge key={idx} tone="blue">{formatResourceItem(mat)}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DetailSection>
      )}

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