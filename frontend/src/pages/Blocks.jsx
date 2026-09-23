import { useCallback, useMemo, useState } from "react";
import { listBlocks } from "../api/blocks.api";
import { useApiQuery } from "../hooks/useApi";
import { useReferenceData } from "../hooks/useReferenceData";
import { BLOCK_STATUSES, AVAILABILITY_OPTIONS, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Filters, { FilterField } from "../components/common/Filters";
import BlocksTable from "../components/blocks/BlocksTable";
import BlockDrawer from "../components/blocks/BlockDrawer";
import Pagination from "../components/common/Pagination";
import StateBlock from "../components/common/StateBlock";

const EMPTY_FILTERS = { status: "", availability: "", sectionId: "" };

export default function Blocks() {
  const { sections } = useReferenceData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      status: filters.status || undefined,
      availability: filters.availability || undefined,
      section_id: filters.sectionId || undefined,
    }),
    [page, pageSize, filters]
  );

  const fetcher = useCallback(() => listBlocks(params), [params]);
  const { data, loading, error, reload } = useApiQuery(fetcher, [JSON.stringify(params)]);

  const pagination = data?.pagination;
  const rows = data?.data || [];

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Infrastructure Blocks"
        subtitle="Physical infrastructure segments available for closure"
        actions={
          <Button variant="primary" loading={loading} loadingText="Loading…" onClick={() => reload()}>
            Load / Refresh
          </Button>
        }
      />

      <section className="card">
        <Filters>
          <FilterField label="Status">
            <select
              className="select"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              aria-label="Filter by block status"
            >
              <option value="">All</option>
              {BLOCK_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Availability">
            <select
              className="select"
              value={filters.availability}
              onChange={(e) => setFilter("availability", e.target.value)}
              aria-label="Filter by availability"
            >
              <option value="">All</option>
              {AVAILABILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
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
          isEmpty={!loading && !error && rows.length === 0}
          loadingMessage="Loading blocks…"
          emptyMessage="No infrastructure blocks found."
          onRetry={() => reload()}
        >
          <BlocksTable rows={rows} loading={loading} onRowClick={setSelected} />

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

      <BlockDrawer block={selected} onClose={() => setSelected(null)} />
    </>
  );
}