import { useCallback, useEffect, useMemo, useState } from "react";
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
  department: "",
  status: "",
  priority: "",
  criticality: "",
  blockId: "",
  sectionId: "",
};

export default function Maintenance() {
  const { blocks, sections } = useReferenceData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  // Auto-open task if ?taskId=... or ?id=... is present in URL
  useEffect(() => {
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
  }, []);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
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
        <Filters
          tip={
            filters.criticality
              ? "Note: the backend supports department, status, priority, block and section filters. Criticality is applied to the loaded page."
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