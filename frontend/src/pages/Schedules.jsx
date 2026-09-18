import { useCallback, useMemo, useState } from "react";
import { listSchedules } from "../api/schedules.api";
import { useApiQuery } from "../hooks/useApi";
import { PLAN_STATUSES, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Filters, { FilterField } from "../components/common/Filters";
import ScheduleList from "../components/schedules/ScheduleList";
import ScheduleDetail from "../components/schedules/ScheduleDetail";
import Pagination from "../components/common/Pagination";
import StateBlock from "../components/common/StateBlock";

export default function Schedules() {
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
    <>
      <PageHeader
        title="Generated Plans"
        subtitle="Saved optimised block plans"
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

      <ScheduleDetail planId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}