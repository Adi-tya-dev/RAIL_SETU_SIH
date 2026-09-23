import { useEffect, useState } from "react";
import { getBlock } from "../../api/blocks.api";
import { listAssets } from "../../api/assets.api";
import { listMaintenance } from "../../api/maintenance.api";
import { listSchedules } from "../../api/schedules.api";
import { useApi } from "../../hooks/useApi";
import { navigate } from "../../hooks/useRoute";
import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { DetailList, DetailSection } from "../common/DetailList";
import { formatDateTime, humanize, formatScore } from "../../utils/formatters";
import {
  statusTone,
  CRITICALITY_TONE,
  LEVEL_LABEL,
  PRIORITY_TONE,
} from "../../utils/constants";
import {
  MapPin,
  ExternalLink,
  Wrench,
  Boxes,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Compass,
} from "lucide-react";

const TABS = ["Overview", "Physical Assets", "Maintenance Tasks", "Possession Plans"];

export default function BlockDrawer({ block, onClose }) {
  const { data, loading, error, run } = useApi();
  const { data: assetsData, loading: loadingAssets, run: runAssets } = useApi();
  const { data: maintenanceData, loading: loadingMaintenance, run: runMaintenance } = useApi();
  const { data: schedulesData, loading: loadingSchedules, run: runSchedules } = useApi();
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    if (block?.block_id) {
      setTab("Overview");
      run(() => getBlock(block.block_id));
      runAssets(() => listAssets({ block_id: block.block_id }));
      runMaintenance(() => listMaintenance({ block_id: block.block_id }));
      runSchedules(() => listSchedules({ block_id: block.block_id }));
    }
  }, [block?.block_id, run, runAssets, runMaintenance, runSchedules]);

  if (!block) return null;

  // Unwrap detailed data and merge over row block so no fields show empty
  const blockDetail = data?.data || data || {};
  const blockData = { ...block, ...blockDetail };

  const startKm = Number(blockData.start_chainage ?? block.start_chainage ?? 0);
  const endKm = Number(blockData.end_chainage ?? block.end_chainage ?? 0);
  const lengthKm = Math.abs(endKm - startKm).toFixed(2);
  const isAvailable =
    blockData.availability === true ||
    String(blockData.status || "").toUpperCase() === "AVAILABLE";

  const assets = assetsData?.data || [];
  const maintenanceTasks = maintenanceData?.data || [];
  const schedules = schedulesData?.data || [];

  const trackInfo = blockData.track || block.track;
  const sectionInfo = trackInfo?.section || blockData.section || block.section;

  return (
    <Drawer
      open={Boolean(block)}
      onClose={onClose}
      width="min(680px, 100vw)"
      title={`Block ${blockData.block_code || block.block_code}`}
      subtitle={`${sectionInfo?.section_name || sectionInfo?.section_code || "Corridor Segment"} · Track ${trackInfo?.track_code || "—"}`}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/map?blockCode=${blockData.block_code || block.block_code}&blockId=${blockData.block_id || block.block_id}`);
              }}
            >
              <MapPin size={13} style={{ marginRight: 6 }} />
              Live Map
            </Button>
            {maintenanceTasks.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  navigate("/maintenance");
                }}
              >
                <Wrench size={13} style={{ marginRight: 6 }} />
                Work Orders
              </Button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {/* Quick Summary Pill Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <Badge tone={statusTone(blockData.status)} dot>
          {blockData.status || "AVAILABLE"}
        </Badge>
        {isAvailable ? (
          <Badge tone="green" dot>
            AVAILABLE FOR TRAINS
          </Badge>
        ) : (
          <Badge tone="red" dot>
            POSSESSION ACTIVE / BLOCKED
          </Badge>
        )}
        <span style={{ fontSize: 12, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
          <Compass size={13} /> Span: {startKm.toFixed(2)} km – {endKm.toFixed(2)} km ({lengthKm} km)
        </span>
      </div>

      {loading && !data && (
        <div className="state state--loading" role="status" style={{ padding: "20px 0" }}>
          <span className="spinner" />
          <p>Loading infrastructure block details…</p>
        </div>
      )}

      {error && !data && (
        <div className="state state--error" role="alert" style={{ marginBottom: 16 }}>
          <p className="state__title">Unable to load complete block details</p>
          <p>{error.message}</p>
          <Button size="sm" onClick={() => run(() => getBlock(block.block_id))}>
            Retry
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {TABS.map((t) => {
          let count = null;
          if (t === "Physical Assets") count = assets.length;
          if (t === "Maintenance Tasks") count = maintenanceTasks.length;
          if (t === "Possession Plans") count = schedules.length;

          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`tab ${tab === t ? "is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              {count !== null && count > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background:
                      t === "Maintenance Tasks" && count > 0
                        ? "rgba(245,158,11,0.2)"
                        : "rgba(255,255,255,0.12)",
                    color: t === "Maintenance Tasks" && count > 0 ? "#f59e0b" : "inherit",
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {tab === "Overview" && (
        <div className="stack" style={{ gap: 16 }}>
          <DetailSection title="Block Information">
            <DetailList
              items={[
                { label: "Block ID", value: <span className="mono">{blockData.block_id}</span> },
                { label: "Block Code", value: <span className="mono cell-strong">{blockData.block_code}</span> },
                {
                  label: "Operational Status",
                  value: <Badge tone={statusTone(blockData.status)} dot>{blockData.status || "AVAILABLE"}</Badge>,
                },
                {
                  label: "Traffic Availability",
                  value: isAvailable ? (
                    <Badge tone="green" dot>AVAILABLE</Badge>
                  ) : (
                    <Badge tone="red" dot>UNAVAILABLE</Badge>
                  ),
                },
                { label: "Start Chainage", value: `${startKm.toFixed(2)} km` },
                { label: "End Chainage", value: `${endKm.toFixed(2)} km` },
                { label: "Segment Span Length", value: `${lengthKm} km` },
                { label: "Created At", value: formatDateTime(blockData.created_at) },
                { label: "Last Updated", value: formatDateTime(blockData.updated_at) },
              ]}
            />
          </DetailSection>

          <DetailSection title="Location & Track Infrastructure">
            <DetailList
              items={[
                { label: "Track Code", value: <span className="mono">{trackInfo?.track_code || "—"}</span> },
                { label: "Track Name", value: trackInfo?.track_name || "—" },
                { label: "Track Type", value: humanize(trackInfo?.track_type) || "MAIN" },
                { label: "Track Gauge", value: trackInfo?.gauge || "Broad Gauge (BG)" },
                { label: "Section Code", value: <span className="mono">{sectionInfo?.section_code || "—"}</span> },
                { label: "Section Name", value: sectionInfo?.section_name || "—" },
              ]}
            />
          </DetailSection>

          <DetailSection title="Corridor Connected Metrics">
            <div className="plan-metrics" style={{ borderTop: "none", paddingTop: 0 }}>
              <div className="metric">
                <span className="metric__label">Physical Assets</span>
                <span className="metric__value">{assets.length}</span>
              </div>
              <div className="metric">
                <span className="metric__label">Maintenance Tasks</span>
                <span className="metric__value" style={{ color: maintenanceTasks.length > 0 ? "var(--accent)" : "inherit" }}>
                  {maintenanceTasks.length}
                </span>
              </div>
              <div className="metric">
                <span className="metric__label">Possession Plans</span>
                <span className="metric__value">{schedules.length}</span>
              </div>
            </div>
          </DetailSection>
        </div>
      )}

      {/* Tab 2: Physical Assets */}
      {tab === "Physical Assets" && (
        <DetailSection title={`Registered Assets on Block ${blockData.block_code} (${assets.length})`}>
          {loadingAssets && (
            <div className="state state--loading" role="status" style={{ padding: "16px 0" }}>
              <span className="spinner" />
              <p>Fetching physical infrastructure assets…</p>
            </div>
          )}

          {!loadingAssets && assets.length === 0 && (
            <p className="text-muted" style={{ margin: 0 }}>
              No physical assets currently mapped to this block segment.
            </p>
          )}

          {!loadingAssets && assets.length > 0 && (
            <div className="snap-list">
              {assets.map((asset) => (
                <div className="snap-row" key={String(asset.asset_id)}>
                  <div className="snap-row__main">
                    <div className="snap-row__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Boxes size={14} style={{ color: "var(--accent)" }} />
                      <span className="mono cell-strong">{asset.asset_code}</span>
                      <span>· {asset.asset_name}</span>
                    </div>
                    <div className="snap-row__meta">
                      Type: {humanize(asset.asset_type)}
                      {asset.criticality && (
                        <span> · Criticality {asset.criticality}</span>
                      )}
                    </div>
                  </div>
                  <div className="snap-row__right" style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <Badge tone={statusTone(asset.status)} dot>
                      {asset.status}
                    </Badge>
                    {asset.criticality && (
                      <Badge tone={CRITICALITY_TONE[asset.criticality]}>
                        {LEVEL_LABEL[asset.criticality]}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}

      {/* Tab 3: Maintenance Tasks */}
      {tab === "Maintenance Tasks" && (
        <DetailSection title={`Active & Scheduled Work Orders (${maintenanceTasks.length})`}>
          {loadingMaintenance && (
            <div className="state state--loading" role="status" style={{ padding: "16px 0" }}>
              <span className="spinner" />
              <p>Fetching maintenance tasks…</p>
            </div>
          )}

          {!loadingMaintenance && maintenanceTasks.length === 0 && (
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                background: "var(--surface)",
                border: "1px solid var(--border-2)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <CheckCircle2 size={24} style={{ color: "var(--green)" }} />
              <div>
                <div style={{ fontWeight: 700, color: "var(--text-1)", fontSize: 14 }}>
                  No Pending Work Orders
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  All track, signal, and overhead systems in this block segment are currently nominal.
                </div>
              </div>
            </div>
          )}

          {!loadingMaintenance && maintenanceTasks.length > 0 && (
            <div className="snap-list">
              {maintenanceTasks.map((t) => (
                <div
                  className="snap-row"
                  key={String(t.maintenance_task_id)}
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Wrench size={14} style={{ color: "var(--accent)" }} />
                      <span className="mono" style={{ fontWeight: 700 }}>
                        Task #{t.maintenance_task_id}
                      </span>
                      <Badge tone={PRIORITY_TONE[t.priority]}>
                        Priority {t.priority}
                      </Badge>
                      <Badge tone="blue">{t.department}</Badge>
                    </div>
                    <Badge tone={statusTone(t.status)} dot>
                      {t.status}
                    </Badge>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                    {t.maintenance_type || t.description || "Routine Maintenance"}
                  </div>

                  {t.description && t.maintenance_type && (
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {t.description}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11.5,
                      color: "var(--text-4)",
                      paddingTop: 4,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <span>Duration: {t.duration_minutes || 60} mins</span>
                    {t.preferred_start && <span>Window: {formatDateTime(t.preferred_start)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}

      {/* Tab 4: Possession Plans */}
      {tab === "Possession Plans" && (
        <DetailSection title={`Block Possession Schedules (${schedules.length})`}>
          {loadingSchedules && (
            <div className="state state--loading" role="status" style={{ padding: "16px 0" }}>
              <span className="spinner" />
              <p>Fetching scheduled block closures…</p>
            </div>
          )}

          {!loadingSchedules && schedules.length === 0 && (
            <p className="text-muted" style={{ margin: 0 }}>
              No maintenance block possessions currently booked for this block.
            </p>
          )}

          {!loadingSchedules && schedules.length > 0 && (
            <div className="snap-list">
              {schedules.map((p) => (
                <div
                  className="snap-row"
                  key={String(p.plan_id)}
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Calendar size={14} style={{ color: "var(--accent)" }} />
                      <span className="mono" style={{ fontWeight: 700 }}>
                        Plan #{p.plan_id}
                      </span>
                      <Badge tone="purple">{p.plan_horizon || "WEEKLY"}</Badge>
                      {p.work_package_code && <Badge tone="cyan">{p.work_package_code}</Badge>}
                    </div>
                    <Badge tone={statusTone(p.status)} dot>
                      {p.status}
                    </Badge>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                    <strong>Planned Window:</strong> {formatDateTime(p.planned_start)} → {formatDateTime(p.planned_end)}
                  </div>

                  {p.optimization_score != null && (
                    <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "var(--text-3)" }}>
                      <span>Optimization Score: <strong>{formatScore(p.optimization_score)}</strong></span>
                      <span>Affected Trains: <strong>{p.affected_train_count ?? 0}</strong></span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        navigate(`/map?blockCode=${blockData.block_code || block.block_code}&blockId=${blockData.block_id || block.block_id}&conflict=true`);
                      }}
                      style={{ fontSize: 11 }}
                    >
                      <MapPin size={12} style={{ marginRight: 4 }} />
                      View on Map
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}
    </Drawer>
  );
}