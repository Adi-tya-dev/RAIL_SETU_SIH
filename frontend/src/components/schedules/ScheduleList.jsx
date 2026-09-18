import Badge from "../common/Badge";
import DataTable from "../common/DataTable";
import { formatDateTime, formatScore, formatNumber } from "../../utils/formatters";
import { statusTone } from "../../utils/constants";

const COLUMNS = [
  { key: "plan_id", label: "Plan ID", className: "cell-mono cell-strong" },
  { key: "block", label: "Block", render: (r) => (r.block ? <span className="cell-mono">{r.block.block_code}</span> : "—") },
  { key: "planned_start", label: "Start", render: (r) => formatDateTime(r.planned_start) },
  { key: "planned_end", label: "End", render: (r) => formatDateTime(r.planned_end) },
  {
    key: "tasks",
    label: "Tasks",
    className: "cell-num",
    render: (r) => formatNumber(r._count?.plan_maintenance_tasks ?? 0),
  },
  {
    key: "affected",
    label: "Affected Trains",
    className: "cell-num",
    render: (r) => formatNumber(r.affected_train_count ?? 0),
  },
  {
    key: "delay",
    label: "Estimated Delay",
    className: "cell-num",
    render: (r) => (r.expected_delay_minutes != null ? `${formatScore(r.expected_delay_minutes, 0)} min` : "—"),
  },
  {
    key: "optimization_score",
    label: "Optimization Score",
    className: "cell-num",
    render: (r) => formatScore(r.optimization_score),
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status || "—"}</Badge>,
  },
];

export default function ScheduleList({ rows, loading, onRowClick, emptyMessage }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      onRowClick={onRowClick}
      ariaLabel="Generated plans"
      emptyMessage={emptyMessage || "No generated schedules yet."}
    />
  );
}