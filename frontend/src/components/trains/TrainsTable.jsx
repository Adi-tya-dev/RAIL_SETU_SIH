import Badge from "../common/Badge";
import DataTable from "../common/DataTable";
import { statusTone, trainPriorityBadge } from "../../utils/constants";

const COLUMNS = [
  { key: "train_number", label: "Train Number", className: "cell-mono cell-strong" },
  { key: "train_name", label: "Train Name", render: (r) => r.train_name || "—" },
  { key: "train_type", label: "Type", render: (r) => r.train_type || "—" },
  {
    key: "origin",
    label: "Origin",
    render: (r) => (r.origin_station ? r.origin_station.station_code : "—"),
  },
  {
    key: "destination",
    label: "Destination",
    render: (r) => (r.destination_station ? r.destination_station.station_code : "—"),
  },
  {
    key: "priority",
    label: "Priority",
    render: (r) => {
      const info = trainPriorityBadge(r.priority);
      return <Badge tone={info.tone}>{info.label}</Badge>;
    },
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status || "—"}</Badge>,
  },
];

export default function TrainsTable({ rows, loading, onRowClick, emptyMessage }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      onRowClick={onRowClick}
      ariaLabel="Trains"
      emptyMessage={emptyMessage || "No trains found."}
    />
  );
}