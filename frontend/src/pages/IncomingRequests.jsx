import { useCallback, useMemo, useState } from "react";
import { Wrench, Signal, Zap, Inbox } from "lucide-react";
import { listIncomingRequests } from "../api/integration.api";
import { useApiQuery } from "../hooks/useApi";
import {
  SOURCE_NAMES,
  SOURCE_TONE,
  MAINTENANCE_STATUSES,
  LEVELS,
  PRIORITY_TONE,
  statusTone,
} from "../utils/constants";
import { formatDateTime, formatDuration, humanize } from "../utils/formatters";
import PageHeader from "../components/common/PageHeader";
import KpiCard from "../components/common/KpiCard";
import Filters, { FilterField } from "../components/common/Filters";
import DataTable from "../components/common/DataTable";
import Pagination from "../components/common/Pagination";
import StateBlock from "../components/common/StateBlock";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import SourceSyncBar from "../components/integration/SourceSyncBar";

const EMPTY_FILTERS = { source: "", status: "", urgency: "", criticality: "" };
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

function pcuBadge(value, toneSource) {
  return <Badge tone={toneSource[value]}>{value}</Badge>;
}

export default function IncomingRequests() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      source: filters.source || undefined,
      status: filters.status || undefined,
      urgency: filters.urgency || undefined,
      criticality: filters.criticality || undefined,
      overdueOnly: filters.overdueOnly ? "true" : undefined,
    }),
    [page, pageSize, filters]
  );

  const fetcher = useCallback(() => listIncomingRequests(params), [params]);
  const { data, loading, error, reload } = useApiQuery(fetcher, [JSON.stringify(params)]);

  const summary = data?.data?.summary;
  const rows = data?.data?.requests || [];
  const pagination = data?.pagination;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.external_ref, r.maintenance_type, r.asset?.asset_code, r.asset?.asset_name, r.block?.block_code, r.section?.section_code, r.source]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(1);
  }

  const columns = useMemo(
    () => [
      {
        key: "external_ref",
        label: "Request",
        render: (r) => (
          <span>
            <strong>{r.external_ref || r.maintenance_task_id}</strong>
            <span className="cell-muted">{humanize(r.maintenance_type)}</span>
          </span>
        ),
      },
      {
        key: "source",
        label: "System",
        render: (r) => <Badge tone={SOURCE_TONE[r.source] || "gray"}>{r.source}</Badge>,
      },
      {
        key: "asset",
        label: "Asset",
        render: (r) => (
          <span>
            <strong>{r.asset?.asset_code || "—"}</strong>
            <span className="cell-muted">{r.asset?.asset_name || ""}</span>
          </span>
        ),
      },
      {
        key: "location",
        label: "Block · Section",
        render: (r) => (
          <span>
            <strong>{r.block?.block_code || "—"}</strong>
            <span className="cell-muted">{r.section?.section_code || ""}</span>
          </span>
        ),
      },
      {
        key: "pcu",
        label: "P / C / U",
        render: (r) => (
          <span style={{ display: "inline-flex", gap: 4 }}>
            {pcuBadge(r.priority, PRIORITY_TONE)}
            {pcuBadge(r.criticality, PRIORITY_TONE)}
            {pcuBadge(r.urgency, PRIORITY_TONE)}
          </span>
        ),
      },
      {
        key: "duration_minutes",
        label: "Duration",
        render: (r) => formatDuration(r.duration_minutes),
      },
      {
        key: "requested_at",
        label: "Requested",
        render: (r) => formatDateTime(r.requested_at),
      },
      {
        key: "preferred_start",
        label: "Preferred Start",
        render: (r) => formatDateTime(r.preferred_start),
      },
      {
        key: "deadline",
        label: "Deadline",
        render: (r) => (
          <span>
            {formatDateTime(r.deadline)}
            {r.overdue && (
              <Badge tone="red" dot style={{ marginLeft: 4 }}>
                Overdue
              </Badge>
            )}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status}</Badge>,
      },
    ],
    []
  );

  const kpis = [
    { key: "TMS", icon: Wrench, color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Engineering · TMS", desc: "Track maintenance system" },
    { key: "SMMS", icon: Signal, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", label: "Signalling · SMMS", desc: "Signalling & telecom maintenance" },
    { key: "TDMS", icon: Zap, color: "#38bdf8", bg: "rgba(56,189,248,0.12)", label: "Traction · TDMS", desc: "Traction distribution maintenance" },
    { key: "Total", icon: Inbox, color: "var(--accent)", bg: "var(--accent-dim)", label: "Total Requests", desc: "All imported source requests" },
  ];

  const serverEmpty = !loading && !error && rows.length === 0;
  const clientEmpty = !loading && !error && rows.length > 0 && visible.length === 0;

  return (
    <>
      <PageHeader
        title="Incoming Maintenance Requests"
        subtitle="Engineering, signalling and traction requests pulled from railway source systems"
      />

      <div className="summary-grid" style={{ marginBottom: "var(--s5)" }}>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            icon={kpi.icon}
            color={kpi.color}
            bgColor={kpi.bg}
            value={kpi.key === "Total" ? summary?.total ?? "—" : summary?.bySource?.[kpi.key] ?? "—"}
            label={kpi.label}
            desc={kpi.desc}
            loading={loading}
          />
        ))}
      </div>

      <SourceSyncBar onSynced={() => reload()} />

      <section className="card">
        <Filters tip="Filters update the API request. Search applies to the loaded page.">
          <FilterField label="Source System">
            <select
              className="select"
              value={filters.source}
              onChange={(e) => setFilter("source", e.target.value)}
              aria-label="Filter by source system"
            >
              <option value="">All</option>
              {SOURCE_NAMES.map((s) => (
                <option key={s} value={s}>{s}</option>
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

          <FilterField label="Urgency">
            <select
              className="select"
              value={filters.urgency}
              onChange={(e) => setFilter("urgency", e.target.value)}
              aria-label="Filter by urgency"
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

          <FilterField label="Search">
            <input
              type="text"
              className="input"
              placeholder="Request ID, asset, block…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search requests"
            />
          </FilterField>

          <FilterField label="Overdue only">
            <div style={{ display: "flex", alignItems: "center", height: "var(--ctrl-h)" }}>
              <input
                type="checkbox"
                checked={Boolean(filters.overdueOnly)}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, overdueOnly: e.target.checked }));
                  setPage(1);
                }}
                aria-label="Only show overdue requests"
              />
            </div>
          </FilterField>

          <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
        </Filters>

        <StateBlock
          loading={loading}
          error={error}
          isEmpty={serverEmpty || clientEmpty}
          loadingMessage="Loading incoming requests…"
          emptyMessage={
            serverEmpty
              ? "No incoming requests yet. Run a sync to pull data from the source systems."
              : "No requests match the current filters."
          }
          onRetry={() => reload()}
        >
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(r) => r.maintenance_task_id}
            ariaLabel="Incoming source maintenance requests"
          />

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
    </>
  );
}