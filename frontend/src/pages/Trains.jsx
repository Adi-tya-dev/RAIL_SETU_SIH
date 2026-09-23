import { useCallback, useMemo, useState } from "react";
import { listTrains } from "../api/trains.api";
import { useApiQuery } from "../hooks/useApi";
import { TRAIN_STATUSES, TRAIN_PRIORITY_OPTIONS, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Filters, { FilterField } from "../components/common/Filters";
import TrainsTable from "../components/trains/TrainsTable";
import TrainDrawer from "../components/trains/TrainDrawer";
import Pagination from "../components/common/Pagination";
import StateBlock from "../components/common/StateBlock";

const EMPTY_FILTERS = { status: "", priority: "" };

export default function Trains() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
    }),
    [page, pageSize, filters]
  );

  const fetcher = useCallback(() => listTrains(params), [params]);
  const { data, loading, error, reload } = useApiQuery(fetcher, [JSON.stringify(params)]);

  const pagination = data?.pagination;
  const rows = data?.data || [];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.train_number, r.train_name, r.train_type]
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

  return (
    <>
      <PageHeader
        title="Train Operations"
        subtitle="Live train status and movement visibility"
        actions={
          <Button variant="primary" loading={loading} loadingText="Loading…" onClick={() => reload()}>
            Load / Refresh
          </Button>
        }
      />

      <section className="card">
        <Filters tip="Search is applied to the loaded page; other filters update the API request.">
          <FilterField label="Search Train" grow>
            <input
              type="text"
              className="input"
              placeholder="Train number or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search trains"
            />
          </FilterField>

          <FilterField label="Status">
            <select
              className="select"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              aria-label="Filter by train status"
            >
              <option value="">All</option>
              {TRAIN_STATUSES.map((s) => (
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
              {TRAIN_PRIORITY_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </FilterField>

          <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
        </Filters>

        <StateBlock
          loading={loading}
          error={error}
          isEmpty={!loading && !error && rows.length === 0}
          loadingMessage="Loading trains…"
          emptyMessage="No trains found."
          onRetry={() => reload()}
        >
          <TrainsTable
            rows={visible}
            loading={loading}
            onRowClick={setSelected}
            emptyMessage={search ? `No trains match "${search}".` : "No trains found."}
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

      <TrainDrawer train={selected} onClose={() => setSelected(null)} />
    </>
  );
}