import Badge from "../common/Badge";
import DataTable from "../common/DataTable";
import { humanize, formatDateTime, formatDuration } from "../../utils/formatters";
import {
  statusTone,
  PRIORITY_TONE,
  CRITICALITY_TONE,
  DEPARTMENT_COLOR,
} from "../../utils/constants";

function pcuBadge(val, toneMap, prefix) {
  if (val == null) return null;
  return (
    <Badge tone={toneMap[val] || "gray"}>
      {prefix}{val}
    </Badge>
  );
}

const COLUMNS = [
  {
    key: "maintenance_task_id",
    label: "Task",
    render: (r) => (
      <span>
        <strong style={{ display: "block" }} className="cell-mono">
          #{r.maintenance_task_id}
        </strong>
        <span className="cell-muted" style={{ fontSize: 12 }}>
          {humanize(r.maintenance_type)}
        </span>
      </span>
    ),
  },
  {
    key: "department",
    label: "Department",
    render: (r) => (
      <Badge tone={DEPARTMENT_COLOR[r.department] || "gray"}>
        {humanize(r.department) || "—"}
      </Badge>
    ),
  },
  {
    key: "location",
    label: "Block · Asset",
    render: (r) => (
      <span>
        <strong style={{ display: "block" }} className="cell-mono">
          {r.block?.block_code || r.block_code || "—"}
        </strong>
        <span className="cell-muted cell-mono" style={{ fontSize: 11 }}>
          {r.asset?.asset_code || r.section?.section_code || "—"}
        </span>
      </span>
    ),
  },
  {
    key: "pcu",
    label: "P / C / U",
    render: (r) => (
      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        {pcuBadge(r.priority, PRIORITY_TONE, "P")}
        {pcuBadge(r.criticality, CRITICALITY_TONE, "C")}
        <span className="cell-mono cell-muted" style={{ fontSize: 11, marginLeft: 2 }}>
          U{r.urgency ?? "—"}
        </span>
      </span>
    ),
  },
  {
    key: "duration_minutes",
    label: "Duration",
    render: (r) => <span className="cell-mono">{formatDuration(r.duration_minutes)}</span>,
  },
  {
    key: "window",
    label: "Schedule Window",
    render: (r) => (
      <div style={{ fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: "var(--text)" }}>
          {formatDateTime(r.preferred_start)}
        </div>
        <div className="cell-muted" style={{ fontSize: 11 }}>
          {r.deadline ? `Due ${formatDateTime(r.deadline)}` : "No deadline"}
        </div>
      </div>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (r) => (
      <Badge tone={statusTone(r.status)} dot>
        {r.status || "—"}
      </Badge>
    ),
  },
];

export default function MaintenanceTable({ rows, loading, onRowClick, emptyMessage }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      onRowClick={onRowClick}
      ariaLabel="Maintenance tasks"
      emptyMessage={emptyMessage || "No maintenance tasks found."}
    />
  );
}