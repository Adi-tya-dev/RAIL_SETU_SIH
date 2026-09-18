import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Package, Clock } from "lucide-react";
import { getCoaData } from "../api/integration.api";
import { useApiQuery } from "../hooks/useApi";
import { GOODS_SERVICE_TONE, statusTone } from "../utils/constants";
import { formatDate, formatTime, formatNumber, humanize, formatDateTime } from "../utils/formatters";
import PageHeader from "../components/common/PageHeader";
import KpiCard from "../components/common/KpiCard";
import DataTable from "../components/common/DataTable";
import StateBlock from "../components/common/StateBlock";
import Badge from "../components/common/Badge";
import SourceSyncBar from "../components/integration/SourceSyncBar";

const TABS = [
  { key: "blocks", label: "Block Availability" },
  { key: "timetable", label: "Timetable" },
  { key: "goods", label: "Goods Train Forecast" },
];

export default function CoaData() {
  const [activeTab, setActiveTab] = useState("blocks");
  const [search, setSearch] = useState("");

  const fetcher = useCallback(() => getCoaData(), []);
  const { data, loading, error, reload } = useApiQuery(fetcher, []);

  const coa = data?.data ?? null;
  const blocks = coa?.blocks ?? [];
  const timetable = coa?.timetable ?? [];
  const goods = coa?.goods_forecast ?? [];

  const availableBlocks = blocks.filter((b) => b?.availability === "AVAILABLE").length;
  const unavailableBlocks = blocks.filter((b) => b?.availability && b.availability !== "AVAILABLE").length;

  const filteredTimetable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return timetable;
    return timetable.filter((t) =>
      [t?.train_number, t?.train_name, t?.station_code].join(" ").toLowerCase().includes(q)
    );
  }, [timetable, search]);

  const filteredGoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return goods;
    return goods.filter((g) =>
      [g?.external_ref, g?.section_code, g?.service, g?.origin_station_code, g?.destination_station_code, g?.train_number]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [goods, search]);

  const blockColumns = useMemo(
    () => [
      { key: "block_code", label: "Block", render: (r) => <strong>{r.block_code}</strong> },
      { key: "track_code", label: "Track" },
      { key: "section_code", label: "Section" },
      {
        key: "availability",
        label: "Availability",
        render: (r) => <Badge tone={statusTone(r.availability)} dot>{r.availability || "—"}</Badge>,
      },
      {
        key: "effective",
        label: "Effective Window",
        render: (r) => (
          <span>
            <strong>{(r.effective_from || "—")} → {(r.effective_to || "—")}</strong>
            <span className="cell-muted">{r.reason || "Corridor slot available"}</span>
          </span>
        ),
      },
    ],
    []
  );

  const timetableColumns = useMemo(
    () => [
      {
        key: "train",
        label: "Train",
        render: (r) => (
          <span>
            <strong>{r.train_number}</strong>
            <span className="cell-muted">{r.train_name}</span>
          </span>
        ),
      },
      { key: "train_type", label: "Type", render: (r) => humanize(r.train_type) },
      { key: "schedule_day", label: "Service Day", render: (r) => formatDate(r.schedule_day) },
      { key: "sequence_number", label: "Seq" },
      { key: "station_code", label: "Station" },
      { key: "scheduled_arrival", label: "Arrival", render: (r) => formatTime(r.scheduled_arrival) },
      { key: "scheduled_departure", label: "Departure", render: (r) => formatTime(r.scheduled_departure) },
    ],
    []
  );

  const goodsColumns = useMemo(
    () => [
      {
        key: "external_ref",
        label: "Reference",
        render: (r) => (
          <span>
            <strong>{r.external_ref}</strong>
            <span className="cell-muted">{r.train_number || "Composed service"}</span>
          </span>
        ),
      },
      { key: "forecast_date", label: "Date", render: (r) => formatDate(r.forecast_date) },
      { key: "section_code", label: "Section", render: (r) => r.section_code },
      {
        key: "service",
        label: "Service",
        render: (r) => <Badge tone={GOODS_SERVICE_TONE[r.service] || "gray"}>{r.service || "—"}</Badge>,
      },
      {
        key: "route",
        label: "Route",
        render: (r) => <span>{r.origin_station_code} → {r.destination_station_code}</span>,
      },
      {
        key: "traffic",
        label: "Load",
        render: (r) => (
          <span>
            <strong>{formatNumber(r.planned_tonnes)} t</strong>
            <span className="cell-muted">{r.rake_count ? `${r.rake_count} rake${r.rake_count > 1 ? "s" : ""}` : ""}</span>
          </span>
        ),
      },
      {
        key: "window",
        label: "Slot Window",
        render: (r) => (
          <span>
            <strong>{formatDateTime(r.start_window)} → {formatDateTime(r.end_window)}</strong>
          </span>
        ),
      },
      { key: "status", label: "Status", render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status}</Badge> },
    ],
    []
  );

  const kpis = [
    { icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.12)", value: availableBlocks, label: "Blocks Available", desc: "COA block availability feed" },
    { icon: XCircle, color: "#ef4444", bg: "rgba(239,68,68,0.12)", value: unavailableBlocks, label: "Blocks Unavailable", desc: "Held for maintenance / repair" },
    { icon: Package, color: "#38bdf8", bg: "rgba(56,189,248,0.12)", value: goods.length, label: "Goods Forecasts", desc: "Freight trains in the horizon" },
    { icon: Clock, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", value: timetable.length, label: "Timetable Rows", desc: "Passenger services on corridor day" },
  ];

  const renderTable = (columns, tableRows, emptyMessage) => (
    <StateBlock
      loading={loading}
      error={error}
      isEmpty={!loading && !error && tableRows.length === 0}
      loadingMessage="Loading COA data…"
      emptyMessage={emptyMessage}
      onRetry={() => reload()}
    >
      <DataTable columns={columns} rows={tableRows} ariaLabel={`${activeTab} COA data`} />
    </StateBlock>
  );

  return (
    <>
      <PageHeader
        title="COA Corridor & Availability Data"
        subtitle="Corridor block availability, timetable and goods-trains published by COA"
        actions={
          <div style={{ position: "relative" }}>
            <input
              type="text"
              className="input"
              style={{ width: 240 }}
              placeholder={activeTab === "goods" ? "Search service, section, route…" : "Search train, station…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search COA data"
            />
          </div>
        }
      />

      <div className="summary-grid" style={{ marginBottom: "var(--s5)" }}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} loading={loading} />
        ))}
      </div>

      <SourceSyncBar onSynced={() => reload()} />

      <section className="card">
        <div className="tabs" role="tablist" aria-label="COA data views">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`tab${activeTab === tab.key ? " is-active" : ""}`}
              onClick={() => {
                setActiveTab(tab.key);
                setSearch("");
              }}
            >
              {tab.label}
              <span style={{ marginLeft: 6, opacity: 0.65 }}>
                ({tab.key === "blocks" ? blocks.length : tab.key === "timetable" ? timetable.length : goods.length})
              </span>
            </button>
          ))}
        </div>

        {activeTab === "blocks" &&
          renderTable(blockColumns, blocks, "No COA block availability records. Run a sync to import corridor data.")}

        {activeTab === "timetable" &&
          (search && filteredTimetable.length === 0 ? (
            <div className="state state--empty">No timetable rows match the current search.</div>
          ) : (
            renderTable(timetableColumns, filteredTimetable, "No COA timetable rows. Run a sync to import corridor data.")
          ))}

        {activeTab === "goods" &&
          (search && filteredGoods.length === 0 ? (
            <div className="state state--empty">No goods forecast rows match the current search.</div>
          ) : (
            renderTable(goodsColumns, filteredGoods, "No COA goods-train forecasts. Run a sync to import corridor data.")
          ))}
      </section>
    </>
  );
}