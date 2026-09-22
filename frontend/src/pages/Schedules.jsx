import { useCallback, useMemo, useState } from "react";
import { listSchedules } from "../api/schedules.api";
import { useApiQuery } from "../hooks/useApi";
import { PLAN_STATUSES, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Filters, { FilterField } from "../components/common/Filters";
import ScheduleList from "../components/schedules/ScheduleList";
import ScheduleDetail from "../components/schedules/ScheduleDetail";
import TwoHorizonPlanner from "../components/schedules/TwoHorizonPlanner";
import Pagination from "../components/common/Pagination";
import StateBlock from "../components/common/StateBlock";
import { BrainCircuit, Clock, Database, Layers } from "lucide-react";
import { navigate } from "../hooks/useRoute";

export default function Schedules() {
  const [activeTab, setActiveTab] = useState("HORIZONS"); // "HORIZONS" | "ARCHIVE"
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState(null);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      status: status || undefined,
    }),
    [page, pageSize, status]
  );

  const fetcher = useCallback(() => listSchedules(params), [params]);
  const { data, loading, error, reload } = useApiQuery(fetcher, [JSON.stringify(params)]);

  const pagination = data?.pagination;
  const rows = data?.data || [];

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <PageHeader
        title="Generated Plans & Operations Horizon"
        subtitle="Two-Horizon maintenance plan management: 30-Day Strategic Resource Blueprint and 7-Day Operational Timetable Reconciliation."
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button
              variant="secondary"
              icon={BrainCircuit}
              onClick={() => navigate("/ml-planning")}
            >
              ML Optimizer Studio
            </Button>
            <Button
              variant="secondary"
              icon={Clock}
              onClick={() => navigate("/slots")}
            >
              Timetable Slots
            </Button>
          </div>
        }
      />

      {/* Main View Mode Selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          background: "var(--surface-2)",
          padding: 6,
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === "HORIZONS" ? "btn--primary" : "btn--ghost"}`}
            onClick={() => setActiveTab("HORIZONS")}
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}
          >
            <Layers size={15} />
            <span>Two-Horizon Active Planner (30d / 7d)</span>
          </button>

          <button
            type="button"
            className={`btn btn--sm ${activeTab === "ARCHIVE" ? "btn--primary" : "btn--ghost"}`}
            onClick={() => {
              setActiveTab("ARCHIVE");
              reload();
            }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
            title="Inspect permanent database records and approval audit trail"
          >
            <Database size={15} />
            <span>Plan History & Audit Log</span>
            <span
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 10,
                background: activeTab === "ARCHIVE" ? "rgba(255,255,255,0.2)" : "var(--surface)",
                color: "inherit",
              }}
            >
              {rows.length}
            </span>
          </button>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-3)", paddingRight: 10 }}>
          {activeTab === "HORIZONS" ? "Interactive Controller Operations View" : "Permanent Database Audit Ledger"}
        </div>
      </div>

      {/* HORIZONS VIEW (30-Day Monthly Blueprint & 7-Day Weekly Operations) */}
      {activeTab === "HORIZONS" && (
        <TwoHorizonPlanner initialTab="WEEKLY" onPlanStatusChange={reload} />
      )}

      {/* ARCHIVE VIEW (Historical Saved Plans Table) */}
      {activeTab === "ARCHIVE" && (
        <section className="card">
          <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Plan History & Database Audit Log</h2>
              <p>Permanent database ledger of all maintenance block plans generated, approved, or cancelled across network corridors</p>
            </div>
            <Button variant="secondary" size="sm" loading={loading} onClick={() => reload()}>
              Reload
            </Button>
          </div>

          <Filters>
            <FilterField label="Status">
              <select
                className="select"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by plan status"
              >
                <option value="">All</option>
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FilterField>
            <Button variant="ghost" onClick={() => { setStatus(""); setPage(1); }}>
              Clear Filters
            </Button>
          </Filters>

          <StateBlock
            loading={loading}
            error={error}
            isEmpty={!loading && !error && rows.length === 0}
            loadingMessage="Loading generated plans…"
            emptyMessage="No generated schedules yet."
            onRetry={() => reload()}
          >
            <ScheduleList rows={rows} loading={loading} onRowClick={(plan) => setSelectedId(plan.plan_id)} />

            <div className="list-toolbar">
              <select
                className="select"
                style={{ width: "auto", minWidth: 90 }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Records per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
            </div>

            {pagination && <Pagination pagination={pagination} onChange={setPage} disabled={loading} />}
          </StateBlock>
        </section>
      )}

      <ScheduleDetail planId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}