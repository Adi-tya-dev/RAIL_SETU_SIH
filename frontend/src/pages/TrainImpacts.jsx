import { useCallback, useEffect, useMemo } from "react";
import { Activity, AlertTriangle, Clock3, Train } from "lucide-react";
import { listTrainImpacts } from "../api/trainImpacts.api";
import { useApi } from "../hooks/useApi";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import { formatNumber, formatScore, humanize } from "../utils/formatters";

const COLUMNS = [
  { key: "train", label: "Train", render: (row) => <span className="cell-mono cell-strong">{row.train?.train_number || row.train_id || "—"}</span> },
  { key: "plan_id", label: "Plan", render: (row) => `#${row.plan_id}` },
  { key: "impact_type", label: "Impact", render: (row) => humanize(row.impact_type) },
  { key: "estimated_delay_minutes", label: "Delay", className: "cell-num", render: (row) => `${formatScore(row.estimated_delay_minutes, 0)} min` },
  { key: "block", label: "Block", render: (row) => row.plan?.block?.block_code || "—" },
];

function Metric({ icon: Icon, label, value, tone = "amber" }) {
  return <div className={`impact-card impact-card--${tone}`}><Icon size={17} /><div className="impact-card__value">{value}</div><div className="impact-card__label">{label}</div></div>;
}

export default function TrainImpacts() {
  const { data, loading, error, run } = useApi();
  const load = useCallback(() => run(() => listTrainImpacts({ limit: 100 })), [run]);
  useEffect(() => { load(); }, [load]);

  const impacts = data?.data || [];
  const summary = useMemo(() => {
    const trains = new Set(impacts.map((impact) => String(impact.train_id || impact.train?.train_id)).filter(Boolean));
    const totalDelay = impacts.reduce((sum, impact) => sum + (Number(impact.estimated_delay_minutes) || 0), 0);
    const critical = impacts.filter((impact) => Number(impact.severity) >= 4).length;
    const conflicts = impacts.filter((impact) => impact.conflict_id || impact.impact_type === "CONFLICT").length;
    return { trains: trains.size, totalDelay, critical, conflicts };
  }, [impacts]);

  return <>
    <PageHeader title="Train Impact Analysis" subtitle="Operational effects derived from saved block plans" actions={<Button variant="primary" loading={loading} loadingText="Loading…" onClick={load}>Refresh</Button>} />
    <div className="impact-summary"><Metric icon={Train} label="Affected Trains" value={formatNumber(summary.trains)} tone="blue" /><Metric icon={Clock3} label="Total Delay" value={`${formatNumber(summary.totalDelay)} min`} tone="amber" /><Metric icon={AlertTriangle} label="Critical Impacts" value={formatNumber(summary.critical)} tone="red" /><Metric icon={Activity} label="Conflicts" value={formatNumber(summary.conflicts)} tone="violet" /></div>
    <section className="card">
      <div className="card__head"><h2>Train Impacts</h2><p>Aggregated from {data?.planCount || 0} saved plan details. No impact values are synthesized.</p></div>
      {loading && <div className="state state--loading"><span className="spinner" /><p>Loading train impacts…</p></div>}
      {!loading && error && <div className="state state--error"><p className="state__title">Unable to load train impacts</p><p>{error.message}</p><Button size="sm" onClick={load}>Retry</Button></div>}
      {!loading && !error && impacts.length === 0 && <div className="state state--empty">No train impacts are present in the loaded plans.</div>}
      {!loading && !error && impacts.length > 0 && <DataTable columns={COLUMNS} rows={impacts} ariaLabel="Train impacts" rowKey={(row, index) => `${row.plan_id}-${row.impact_id || index}`} />}
    </section>
  </>;
}