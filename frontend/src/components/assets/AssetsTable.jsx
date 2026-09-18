import Badge from "../common/Badge";
import DataTable from "../common/DataTable";
import { humanize } from "../../utils/formatters";
import { statusTone, CRITICALITY_TONE, LEVEL_LABEL } from "../../utils/constants";

const COLUMNS = [
  { key: "asset_id", label: "Asset ID", className: "cell-mono" },
  { key: "asset_code", label: "Asset Code", className: "cell-mono cell-strong" },
  { key: "asset_type", label: "Type", render: (r) => humanize(r.asset_type) },
  { key: "block", label: "Block", render: (r) => (r.block ? <span className="cell-mono">{r.block.block_code}</span> : "—") },
  { key: "section", label: "Section", render: (r) => (r.section ? <span className="cell-mono">{r.section.section_code}</span> : "—") },
  {
    key: "criticality",
    label: "Criticality",
    render: (r) => <Badge tone={CRITICALITY_TONE[r.criticality]}>{LEVEL_LABEL[r.criticality]}</Badge>,
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status || "—"}</Badge>,
  },
];

export default function AssetsTable({ rows, loading, onRowClick, emptyMessage }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      onRowClick={onRowClick}
      ariaLabel="Assets"
      emptyMessage={emptyMessage || "No assets found."}
    />
  );
}