import { useCallback, useEffect } from "react";
import { getTrain } from "../../api/trains.api";
import { useApi } from "../../hooks/useApi";
import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { DetailList, DetailSection } from "../common/DetailList";
import { formatDateTime } from "../../utils/formatters";
import { statusTone, trainPriorityBadge } from "../../utils/constants";

export default function TrainDrawer({ train, onClose }) {
  const { data, loading, error, run } = useApi();

  useEffect(() => {
    if (train) run(() => getTrain(train.train_id));
  }, [train, run]);

  if (!train) return null;

  const routes = data?.train_routes || [];
  const movements = data?.train_block_movements || [];

  return (
    <Drawer
      open={Boolean(train)}
      onClose={onClose}
      title={`${train.train_number} — ${train.train_name}`}
      subtitle={train.train_type || "Train"}
      footer={<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}
    >
      {loading && (
        <div className="state state--loading" role="status">
          <span className="spinner" />
          <p>Loading train details…</p>
        </div>
      )}

      {error && (
        <div className="state state--error" role="alert">
          <p className="state__title">Unable to load train details</p>
          <p>{error.message}</p>
          <Button size="sm" onClick={() => run(() => getTrain(train.train_id))}>Retry</Button>
        </div>
      )}

      {data && (
        <>
          <DetailSection title="Train Information">
            <DetailList
              items={[
                { label: "Train Number", value: data.train_number },
                { label: "Train Name", value: data.train_name },
                { label: "Type", value: data.train_type },
                { label: "Priority", value: <Badge tone={trainPriorityBadge(data.priority).tone}>{trainPriorityBadge(data.priority).label}</Badge> },
                { label: "Status", value: <Badge tone={statusTone(data.status)} dot>{data.status}</Badge> },
                { label: "Origin", value: data.origin_station?.station_code || "—" },
                { label: "Destination", value: data.destination_station?.station_code || "—" },
              ]}
            />
          </DetailSection>

          <DetailSection title="Route">
            {routes.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>No route data available.</p>
            ) : (
              <div className="snap-list">
                {routes.map((route) => (
                  <div className="snap-row" key={String(route.train_route_id)}>
                    <div className="snap-row__main">
                      <div className="snap-row__title">
                        <span className="mono">{route.station?.station_code || "—"}</span> ·{" "}
                        {route.station?.station_name || "Unknown"}
                      </div>
                      <div className="snap-row__meta">Sequence {route.sequence_number}</div>
                    </div>
                    <div className="snap-row__right">
                      {formatDateTime(route.scheduled_arrival)} → {formatDateTime(route.scheduled_departure)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Train Block Movements">
            {movements.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>No block movements recorded.</p>
            ) : (
              <div className="snap-list">
                {movements.map((m) => (
                  <div className="snap-row" key={String(m.movement_id)}>
                    <div className="snap-row__main">
                      <div className="snap-row__title">
                        <span className="mono">{m.block?.block_code || "—"}</span>
                      </div>
                      <div className="snap-row__meta">
                        Entry {formatDateTime(m.scheduled_entry)}
                      </div>
                    </div>
                    <div className="snap-row__right">Exit {formatDateTime(m.scheduled_exit)}</div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>
        </>
      )}
    </Drawer>
  );
}