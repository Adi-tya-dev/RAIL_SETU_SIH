import { useCallback, useMemo, useState } from "react";
import { listAssets } from "../api/assets.api";
import { useApiQuery } from "../hooks/useApi";
import { useReferenceData } from "../hooks/useReferenceData";
import { ASSET_STATUSES, LEVELS, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Filters, { FilterField } from "../components/common/Filters";
import AssetsTable from "../components/assets/AssetsTable";
import AssetDrawer from "../components/assets/AssetDrawer";
import Pagination from "../components/common/Pagination";
import StateBlock from "../components/common/StateBlock";

const EMPTY_FILTERS = { status: "", criticality: "", blockId: "", sectionId: "" };

export default function Assets() {
  const { blocks, sections } = useReferenceData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      status: filters.status || undefined,
      criticality: filters.criticality || undefined,
      block_id: filters.blockId || undefined,
      section_id: filters.sectionId || undefined,
    }),
    [page, pageSize, filters]
  );

  const fetcher = useCallback(() => listAssets(params), [params]);
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
        title="Asset Health"
        subtitle="Health and criticality of railway assets"
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
              aria-label="Filter by asset status"
            >
              <option value="">All</option>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Criticality">
            <select
              className="select"
              value={filters.criticality}
              onChange={(e) => setFilter("criticality", e.target.value)}
              aria-label="Filter by asset criticality"
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
          isEmpty={!loading && !error && rows.length === 0}
          loadingMessage="Loading assets…"
          emptyMessage="No assets found."
          onRetry={() => reload()}
        >
          <AssetsTable rows={rows} loading={loading} onRowClick={setSelected} />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "8px 16px 0" }}>
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

      <AssetDrawer asset={selected} onClose={() => setSelected(null)} />
    </>
  );
}