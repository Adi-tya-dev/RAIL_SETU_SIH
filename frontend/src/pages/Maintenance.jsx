import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "../hooks/useRoute";
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

export default function Maintenance() {
  const routePath = useRoute();
  const dateInputRef = useRef(null);
  const todayDate = new Date();
  const todayShortStr = todayDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  
  const getDynamicDate = (offset) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + offset);
    return {
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    };
  };

  const dynamicDates = [
    { ...getDynamicDate(0), suffix: " (Today)" },
    getDynamicDate(1),
    getDynamicDate(2),
    getDynamicDate(3),
    getDynamicDate(4),
  ];
  const { blocks, sections } = useReferenceData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  // Auto-open task if ?taskId=... or ?id=... is present in URL, and handle ?day=... or ?date=...
  useEffect(() => {
    const raw = routePath.includes("?")
      ? routePath.split("?")[1]
      : (window.location.hash.includes("?")
          ? window.location.hash.split("?")[1]
          : window.location.search.replace(/^\?/, ""));
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
    } else if (qParams.has("day") && !dayParam) {
      setFilters((f) => ({ ...f, day: "" }));
    }
    const deptParam = qParams.get("department") || qParams.get("dept");
    if (deptParam) {
      setFilters((f) => ({ ...f, department: deptParam.toUpperCase() }));
    }
    const statusParam = qParams.get("status");
    if (statusParam) {
      setFilters((f) => ({ ...f, status: statusParam.toUpperCase() }));
    }
  }, [routePath]);

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
  }, [rows, search, filters.criticality]);

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
        {/* Quick Day Selector Pills & Interactive Calendar Picker */}
        {(() => {
          const localTodayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
          const todayFormatted = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" });
          const isCustomDate = Boolean(filters.day && filters.day.includes("-"));

          return (
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
              {/* Clickable Calendar Day Trigger */}
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (dateInputRef.current) {
                      if (typeof dateInputRef.current.showPicker === "function") {
                        try {
                          dateInputRef.current.showPicker();
                        } catch {
                          dateInputRef.current.focus();
                        }
                      } else {
                        dateInputRef.current.focus();
                      }
                    }
                  }}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isCustomDate ? "var(--accent, #38bdf8)" : "var(--text-2)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: isCustomDate ? "var(--accent-dim, rgba(56, 189, 248, 0.12))" : "rgba(255, 255, 255, 0.04)",
                    border: isCustomDate ? "1px solid var(--accent, #38bdf8)" : "1px solid var(--border)",
                    borderRadius: 16,
                    padding: "3px 10px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Click to open calendar and choose a date"
                >
                  <Calendar size={14} color="var(--accent)" />
                  <span>{isCustomDate ? `Day: ${filters.day}` : "Day:"}</span>
                  {isCustomDate && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilter("day", "");
                      }}
                      style={{
                        marginLeft: 4,
                        padding: "0 3px",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 11,
                        color: "var(--text-3)",
                      }}
                      title="Clear date"
                    >
                      ✕
                    </span>
                  )}
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={isCustomDate ? filters.day : localTodayStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      setFilter("day", e.target.value);
                    }
                  }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    pointerEvents: "none",
                  }}
                  tabIndex={-1}
                  aria-label="Pick date from calendar"
                />
              </div>
              {[
                { id: "", label: "All Days" },
                { id: "today", label: `Today (${todayFormatted})`, highlight: true },
                { id: "tomorrow", label: "Tomorrow / Next Shifts" },
                { id: "week", label: "Next 7 Days" },
                { id: "overdue", label: "Past / Overdue" },
              ].map((pill) => {
                const isActive = (pill.id === "today" && (filters.day === "today" || filters.day === localTodayStr)) ||
                                 (!pill.id && !filters.day) ||
                                 (pill.id && filters.day === pill.id);
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
          );
        })()}

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
              <option value="today">Today ({new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" })})</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">Next 7 Days</option>
              <option value="overdue">Past / Overdue</option>
              {dynamicDates.map(d => (
                <option key={d.value} value={d.value}>{d.label}{d.suffix || ""}</option>
              ))}
              {filters.day && filters.day.includes("-") && !dynamicDates.some(d => d.value === filters.day) && (
                <option value={filters.day}>{filters.day} (Calendar Selected)</option>
              )}
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
            clientEmpty ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <p style={{ margin: "0 0 10px 0" }}>No tasks match the current search or criticality filter.</p>
                <Button size="xs" variant="outline" onClick={() => { setSearch(""); setFilter("criticality", ""); }}>
                  Clear Search & Criticality Filter
                </Button>
              </div>
            ) : filters.day ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <p style={{ margin: "0 0 10px 0" }}>
                  No maintenance tasks scheduled for {filters.day === "today" ? "today" : filters.day}.
                </p>
                <Button size="xs" variant="primary" onClick={() => setFilter("day", "")}>
                  Show All Days
                </Button>
              </div>
            ) : (
              "No maintenance tasks found."
            )
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