import Badge from "../common/Badge";
import DataTable from "../common/DataTable";
import { statusTone } from "../../utils/constants";

function AvailabilityBadge({ block }) {
  if (block.availability) return <Badge tone="green" dot>AVAILABLE</Badge>;
  return <Badge tone="red" dot>UNAVAILABLE</Badge>;
}

const COLUMNS = [
  { key: "block_id", label: "Block ID", className: "cell-mono" },
  { key: "block_code", label: "Block Code", className: "cell-mono cell-strong" },
  {
    key: "section",
    label: "Section",
    render: (r) => (r.track?.section ? r.track.section.section_code : "—"),
  },
  { key: "track", label: "Track", render: (r) => (r.track ? r.track.track_code : "—") },
  {
    key: "start_chainage",
    label: "Start Chainage",
    className: "cell-num",
    render: (r) => Number(r.start_chainage).toFixed(2),
  },
  {
    key: "end_chainage",
    label: "End Chainage",
    className: "cell-num",
    render: (r) => Number(r.end_chainage).toFixed(2),
  },
  {
    key: "length",
    label: "Length",
    className: "cell-num",
    render: (r) => `${(Number(r.end_chainage || 0) - Number(r.start_chainage || 0)).toFixed(2)} km`,
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status || "—"}</Badge>,
  },
  { key: "availability", label: "Availability", render: (r) => <AvailabilityBadge block={r} /> },
];

export default function BlocksTable({ rows, loading, onRowClick, emptyMessage }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      onRowClick={onRowClick}
      ariaLabel="Infrastructure blocks"
      emptyMessage={emptyMessage || "No infrastructure blocks found."}
    />
  );
}