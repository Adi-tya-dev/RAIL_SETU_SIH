import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { listMaintenance, getMaintenance } from "../api/maintenance.api";
import { useApiQuery } from "../hooks/useApi";
import { useReferenceData } from "../hooks/useReferenceData";
import {
  DEPARTMENTS,
  MAINTENANCE_STATUSES,
  LEVELS,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Filters, { FilterField } from "../components/common/Filters";
import MaintenanceTable from "../components/maintenance/MaintenanceTable";
import MaintenanceDrawer from "../components/maintenance/MaintenanceDrawer";
import Pagination from "../components/common/Pagination";
import StateBlock from "../components/common/StateBlock";

const EMPTY_FILTERS = {
  day: "",
  department: "",
  status: "",
  priority: "",
  criticality: "",
  blockId: "",
  sectionId: "",
};

function matchTaskDay(task, dayFilter) {
  if (!dayFilter || dayFilter === "all") return true;
  const dLower = String(dayFilter).toLowerCase();
  const taskStart = task.preferred_start || task.requested_at || task.created_at;
  const taskDateStr = taskStart ? new Date(taskStart).toISOString().slice(0, 10) : "";

  if (dLower === "today") {
    const realToday = new Date().toISOString().slice(0, 10);
    return taskDateStr === "2026-09-15" || taskDateStr === realToday;
  }
  if (dLower === "tomorrow") {
    const realTomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return taskDateStr === "2026-09-16" || taskDateStr === "2026-09-19" || taskDateStr === realTomorrow;
  }
  if (dLower === "week") {
    return taskDateStr >= "2026-09-15" && taskDateStr <= "2026-09-22";
  }
  if (dLower === "overdue") {
    if (task.status === "COMPLETED") return false;
    return task.deadline && new Date(task.deadline) < new Date("2026-09-16T00:00:00Z");
  }
  if (dLower.includes("-")) {
    return taskDateStr === dLower;
  }
  return true;
}

export default function Maintenance() {
  const { blocks, sections } = useReferenceData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  // Auto-open task if ?taskId=... or ?id=... is present in URL, and handle ?day=... or ?date=...
  useEffect(() => {
    function parseParams() {
      const raw = window.location.hash.includes("?")
        ? window.location.hash.split("?")[1]
        : window.location.search.replace(/^\?/, "");
      const qParams = new URLSearchParams(raw);
      const taskId = qParams.get("taskId") || qParams.get("id");
      if (taskId) {
        getMaintenance(taskId).then((res) => {
          if (res?.data) setSelected(res.data);
        }).catch(() => {});
      }
      const dayParam = qParams.get("day") || qParams.get("date");
      if (dayParam) {
        setFilters((f) => ({ ...f, day: dayParam.toLowerCase() }));
      }
      const deptParam = qParams.get("department") || qParams.get("dept");
      if (deptParam) {
        setFilters((f) => ({ ...f, department: deptParam.toUpperCase() }));
      }
      const statusParam = qParams.get("status");
      if (statusParam) {
        setFilters((f) => ({ ...f, status: statusParam.toUpperCase() }));
      }
    }

    parseParams();
    window.addEventListener("hashchange", parseParams);
    return () => window.removeEventListener("hashchange", parseParams);
  }, []);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      day: filters.day || undefined,
      department: filters.department || undefined,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      block_id: filters.blockId || undefined,
      section_id: filters.sectionId || undefined,
    }),
    [page, pageSize, filters]
  );

  const fetcher = useCallback(() => listMaintenance(params), [params]);
  const { data, loading, error, reload } = useApiQuery(fetcher, [JSON.stringify(params)]);

  const pagination = data?.pagination;
  const rows = data?.data || [];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.criticality && String(r.criticality) !== filters.criticality) return false;
      if (!matchTaskDay(r, filters.day)) return false;
      if (!q) return true;
      const haystack = [
        r.maintenance_task_id,
        r.department,
        r.maintenance_type,
        r.block?.block_code,
        r.section?.section_code,
        r.asset?.asset_code,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, filters.criticality, filters.day]);

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(1);
  }

  const serverEmpty = !loading && !error && rows.length === 0;
  const clientEmpty = !loading && !error && rows.length > 0 && visible.length === 0;

  return (
    <>
      <PageHeader
        title="Maintenance Tasks"
        subtitle="Track maintenance requests and readiness"
        actions={
          <Button variant="primary" loading={loading} loadingText="Loading…" onClick={() => reload()}>
            Load / Refresh
          </Button>
        }
      />

      <section className="card">
        {/* Quick Day Selector Pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "14px 16px 10px",
            borderBottom: "1px solid var(--border)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}>
            <Calendar size={13} color="var(--accent)" /> Day:
          </span>
          {[
            { id: "", label: "All Days" },
            { id: "today", label: "Today (15 Sep)", highlight: true },
            { id: "tomorrow", label: "Tomorrow / Next Shifts" },
            { id: "week", label: "Next 7 Days" },
            { id: "overdue", label: "Past / Overdue" },
          ].map((pill) => {
            const isActive = filters.day === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                className={`btn btn--xs ${isActive ? "btn--primary" : "btn--secondary"}`}
                style={{
                  borderRadius: 16,
                  padding: "3px 12px",
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? undefined : (pill.highlight ? "1px solid var(--amber)" : undefined),
                  color: !isActive && pill.highlight ? "var(--amber)" : undefined,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
                onClick={() => setFilter("day", pill.id)}
              >
                {pill.highlight && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", display: "inline-block" }} />}
                {pill.label}
              </button>
            );
          })}
        </div>

        <Filters
          tip={
            filters.criticality
              ? "Note: the backend supports day, department, status, priority, block and section filters. Criticality is applied to the loaded page."
              : "Search and criticality are applied to the currently loaded page; other filters update the API request."
          }
        >
          <FilterField label="Search" grow>
            <input
              type="text"
              className="input"
              placeholder="Task ID, type, asset, block…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search maintenance tasks"
            />
          </FilterField>

          <FilterField label="Day">
            <select
              className="select"
              value={filters.day}
              onChange={(e) => setFilter("day", e.target.value)}
              aria-label="Filter by day"
            >
              <option value="">All</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">Next 7 Days</option>
              <option value="overdue">Past / Overdue</option>
              <option value="2026-09-15">15 Sep 2026 (Today)</option>
              <option value="2026-09-19">19 Sep 2026</option>
              <option value="2026-09-20">20 Sep 2026</option>
              <option value="2026-09-21">21 Sep 2026</option>
              <option value="2026-09-22">22 Sep 2026</option>
            </select>
          </FilterField>

          <FilterField label="Department">
            <select
              className="select"
              value={filters.department}
              onChange={(e) => setFilter("department", e.target.value)}
              aria-label="Filter by department"
            >
              <option value="">All</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Status">
            <select
              className="select"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All</option>
              {MAINTENANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Priority">
            <select
              className="select"
              value={filters.priority}
              onChange={(e) => setFilter("priority", e.target.value)}
              aria-label="Filter by priority"
            >
              <option value="">All</option>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Criticality">
            <select
              className="select"
              value={filters.criticality}
              onChange={(e) => setFilter("criticality", e.target.value)}
              aria-label="Filter by criticality"
            >
              <option value="">All</option>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Block">
            <select
              className="select"
              value={filters.blockId}
              onChange={(e) => setFilter("blockId", e.target.value)}
              aria-label="Filter by block"
            >
              <option value="">All</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>{b.code}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Section">
            <select
              className="select"
              value={filters.sectionId}
              onChange={(e) => setFilter("sectionId", e.target.value)}
              aria-label="Filter by section"
            >
              <option value="">All</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
          </FilterField>

          <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
        </Filters>

        <StateBlock
          loading={loading}
          error={error}
          isEmpty={serverEmpty || clientEmpty}
          loadingMessage="Loading maintenance data…"
          emptyMessage={
            clientEmpty
              ? "No tasks match the current search or criticality filter."
              : "No maintenance tasks found."
          }
          onRetry={() => reload()}
        >
          <MaintenanceTable
            rows={visible}
            loading={loading}
            onRowClick={setSelected}
            emptyMessage="No maintenance tasks found."
          />

          {pagination && (
            <Pagination
              pagination={pagination}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              disabled={loading}
            />
          )}
        </StateBlock>
      </section>

      <MaintenanceDrawer task={selected} onClose={() => setSelected(null)} />
    </>
  );
}