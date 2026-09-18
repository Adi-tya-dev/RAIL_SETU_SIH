import { useCallback } from "react";
import {
  Train, Wrench, AlertTriangle, Grid3x3, Cpu,
  CheckSquare, Activity, ClipboardList, RefreshCw,
  TrendingUp, ShieldAlert, Clock
} from "lucide-react";
import { getSummary } from "../api/dashboard.api";
import { listConflicts } from "../api/conflicts.api";
import { useApiQuery } from "../hooks/useApi";
import { navigate } from "../hooks/useRoute";
import KpiCard from "../components/common/KpiCard";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SectionHeader from "../components/common/SectionHeader";
import StateBlock from "../components/common/StateBlock";

const QUICK_ACTIONS = [
  { label: "Maintenance Tasks", sub: "Review all maintenance requests", to: "/maintenance" },
  { label: "Infrastructure Blocks", sub: "Block availability and status", to: "/blocks" },
  { label: "Train Operations", sub: "Active trains and movements", to: "/trains" },
  { label: "Generate Plan", sub: "Run the block planning engine", to: "/planning" },
  { label: "View Plans", sub: "Saved optimised block plans", to: "/schedules" },
  { label: "Railway Map", sub: "Interactive route and maintenance map", to: "/map" },
];

function NetworkStatus({ data }) {
  if (!data) return null;
  const { blocks, maintenance, trains, plans } = data;
  const totalBlocks = blocks?.total || 0;
  const availBlocks = blocks?.available || 0;
  const availPct = totalBlocks > 0 ? Math.round((availBlocks / totalBlocks) * 100) : 0;

  const items = [
    {
      icon: Grid3x3, label: "Block Availability",
      value: totalBlocks > 0 ? `${availPct}%` : "—",
      desc: `${availBlocks} of ${totalBlocks} blocks available`,
      color: availPct >= 80 ? "var(--green)" : availPct >= 60 ? "var(--amber)" : "var(--red)",
      bg: availPct >= 80 ? "var(--green-dim)" : availPct >= 60 ? "var(--amber-dim)" : "var(--red-dim)",
    },
    {
      icon: Wrench, label: "Pending Maintenance",
      value: maintenance?.pending ?? "—",
      desc: `${maintenance?.critical ?? 0} critical tasks`,
      color: (maintenance?.critical || 0) > 0 ? "var(--red)" : "var(--amber)",
      bg: (maintenance?.critical || 0) > 0 ? "var(--red-dim)" : "var(--amber-dim)",
    },
    {
      icon: Train, label: "Active Trains",
      value: trains?.active ?? "—",
      desc: `${trains?.total ?? 0} total in system`,
      color: "var(--blue)",
      bg: "var(--blue-dim)",
    },
    {
      icon: ClipboardList, label: "Active Plans",
      value: plans?.active ?? "—",
      desc: `${plans?.total ?? 0} total generated`,
      color: "var(--violet)",
      bg: "var(--violet-dim)",
    },
  ];

  return (
    <div className="ops-grid">
      {items.map((item) => (
        <div key={item.label} className="ops-item">
          <div className="ops-item__icon" style={{ background: item.bg, color: item.color }}>
            <item.icon size={20} />
          </div>
          <div className="ops-item__info">
            <div className="ops-item__value" style={{ color: item.color }}>{item.value}</div>
            <div className="ops-item__label">{item.label}</div>
            <div className="text-xs text-faint" style={{ marginTop: 2 }}>{item.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const fetcher = useCallback(() => getSummary(), []);
  const { data: res, loading, error, reload } = useApiQuery(fetcher, []);
  const conflictsQuery = useApiQuery(useCallback(() => listConflicts({ limit: 100 }), []), []);
  const data = res?.data;
  const openConflicts = (conflictsQuery.data?.data || []).filter((conflict) => !conflict.resolved).length;

  const kpis = [
    {
      icon: Train, label: "Active Trains",
      value: data?.trains?.active,
      desc: `${data?.trains?.total ?? "—"} total trains`,
      color: "var(--blue)", bg: "var(--blue-dim)",
    },
    {
      icon: Wrench, label: "Pending Maintenance",
      value: data?.maintenance?.pending,
      desc: `${data?.maintenance?.total ?? "—"} total tasks`,
      color: "var(--amber)", bg: "var(--amber-dim)",
    },
    {
      icon: ShieldAlert, label: "Critical Maintenance",
      value: data?.maintenance?.critical,
      desc: "Criticality level 4",
      color: "var(--red)", bg: "var(--red-dim)",
    },
    {
      icon: Grid3x3, label: "Available Blocks",
      value: data?.blocks?.available,
      desc: `${data?.blocks?.total ?? "—"} total blocks`,
      color: "var(--green)", bg: "var(--green-dim)",
    },
    {
      icon: AlertTriangle, label: "Unavailable Blocks",
      value: data?.blocks?.unavailable,
      desc: "Currently closed",
      color: "var(--orange)", bg: "var(--orange-dim)",
    },
    {
      icon: Cpu, label: "Critical Assets",
      value: data?.assets?.critical,
      desc: `${data?.assets?.defective ?? "—"} defective`,
      color: "var(--violet)", bg: "var(--violet-dim)",
    },
    {
      icon: AlertTriangle, label: "Open Conflicts",
      value: conflictsQuery.loading ? undefined : openConflicts,
      desc: conflictsQuery.error ? "Conflict data unavailable" : "Across saved plans",
      color: "var(--red)", bg: "var(--red-dim)",
    },
    {
      icon: ClipboardList, label: "Generated Plans",
      value: data?.plans?.total,
      desc: `${data?.plans?.active ?? "—"} active plans`,
      color: "var(--cyan)", bg: "var(--cyan-dim)",
    },
  ];

  return (
    <>
      <PageHeader
        title="Railway Operations Dashboard"
        subtitle="Current operational state of the railway maintenance network"
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} loadingText="Refreshing…" onClick={() => reload()}>
            Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            icon={k.icon}
            value={k.value}
            label={k.label}
            desc={k.desc}
            color={k.color}
            bgColor={k.bg}
            loading={loading}
          />
        ))}
      </div>

      {/* Network Status */}
      <div className="mt-24">
        <SectionHeader title="Network Operational Status" icon={TrendingUp} />
        {error ? (
          <div className="not-connected">
            <div className="not-connected__title">Unable to load operational data</div>
            <p style={{ color: "var(--text-3)", marginTop: 8 }}>{error.message}</p>
            <div style={{ marginTop: 16 }}>
              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => reload()}>Retry</Button>
            </div>
          </div>
        ) : (
          <NetworkStatus data={data} />
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-24">
        <SectionHeader title="Quick Navigation" icon={Activity} />
        <div className="quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <button key={action.to} type="button" className="quick-action" onClick={() => navigate(action.to)}>
              <span className="quick-action__title">{action.label}</span>
              <span className="quick-action__sub">{action.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Planning Philosophy */}
      <div className="mt-24">
        <SectionHeader title="How RailSetu Plans Maintenance" icon={Clock} />
        <div className="logic-panel">
          <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 16 }}>
            RailSetu uses rule-based deterministic planning — not AI. Every scheduling decision is explainable and traceable.
          </p>
          <div className="logic-steps">
            {[
              ["Maintenance Priority", "Combines priority level, criticality, urgency, and deadline risk into a weighted score"],
              ["Block Availability", "Cross-references physical block availability against the planning window"],
              ["Train Movement Conflicts", "Detects overlaps where trainEntry < maintenanceEnd AND trainExit > maintenanceStart"],
              ["Compatible Task Grouping", "Groups tasks on the same block with overlapping preferred windows into Mega Blocks"],
              ["Deadline Compliance", "Ensures all grouped tasks satisfy their individual deadline constraints"],
              ["Operational Impact", "Calculates estimated train delay from the blocked interval and movement timing"],
              ["Optimization Score", "Combines all factors into a plan score — higher is better for operational continuity"],
            ].map(([title, desc], i) => (
              <div key={i} className="logic-step">
                <div className="logic-step__num">{i + 1}</div>
                <div className="logic-step__text"><strong>{title}</strong> — {desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}