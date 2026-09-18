import { useCallback, useMemo } from "react";
import { listMaintenance } from "../../api/maintenance.api";
import { listAssets } from "../../api/assets.api";
import { useApiQuery } from "../../hooks/useApi";
import Card from "../common/Card";
import MiniBarChart, { Legend } from "../common/MiniBarChart";

function DepartmentChart() {
  const fetcher = useCallback(() => listMaintenance({ limit: 100 }), []);
  const { data, loading, error } = useApiQuery(fetcher, []);
  const rows = data?.data || [];

  const items = useMemo(() => {
    const counts = {};
    rows.forEach((t) => {
      const dept = t.department || "UNKNOWN";
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  if (loading) return <div className="state state--loading" role="status"><span className="spinner" /><p>Loading maintenance data…</p></div>;
  if (error) return <div className="state state--error" role="alert"><p>{error.message}</p></div>;
  if (items.length === 0) return <div className="state state--empty">No maintenance tasks found.</div>;
  return <MiniBarChart data={items} tone="accent" />;
}

function CriticalityChart() {
  const fetcher = useCallback(() => listAssets({ limit: 100 }), []);
  const { data, loading, error } = useApiQuery(fetcher, []);
  const rows = data?.data || [];

  const items = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    rows.forEach((a) => {
      const level = a.criticality != null ? Number(a.criticality) : 0;
      if (level >= 1 && level <= 4) counts[level] += 1;
    });
    const tones = { 1: "blue", 2: "amber", 3: "orange", 4: "red" };
    return [1, 2, 3, 4].map((level) => ({
      label: `Criticality ${level}`,
      value: counts[level],
      tone: tones[level],
    }));
  }, [rows]);

  if (loading) return <div className="state state--loading" role="status"><span className="spinner" /><p>Loading asset data…</p></div>;
  if (error) return <div className="state state--error" role="alert"><p>{error.message}</p></div>;
  if (rows.length === 0) return <div className="state state--empty">No assets found.</div>;
  return <MiniBarChart data={items} />;
}

function AvailabilityChart({ summary }) {
  const b = summary?.blocks || {};
  const items = [
    { label: "Available", value: b.available || 0, tone: "green" },
    { label: "Unavailable", value: b.unavailable || 0, tone: "red" },
  ];
  return <MiniBarChart data={items} />;
}

export default function DistributionCharts({ summary }) {
  return (
    <div className="grid grid--3">
      <Card title="Maintenance by Department" bodyClassName="card--padded">
        <DepartmentChart />
      </Card>
      <Card title="Asset Criticality Distribution" bodyClassName="card--padded">
        <CriticalityChart />
      </Card>
      <Card title="Block Availability" bodyClassName="card--padded">
        {summary ? (
          <AvailabilityChart summary={summary} />
        ) : (
          <div className="state state--empty">Summary data unavailable.</div>
        )}
        <Legend
          items={[
            { label: "Available", value: summary?.blocks?.available || 0, tone: "green" },
            { label: "Unavailable", value: summary?.blocks?.unavailable || 0, tone: "red" },
          ]}
        />
      </Card>
    </div>
  );
}