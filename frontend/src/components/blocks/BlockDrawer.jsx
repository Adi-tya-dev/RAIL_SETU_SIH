import { useCallback, useEffect } from "react";
import { getBlock } from "../../api/blocks.api";
import { useApi } from "../../hooks/useApi";
import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { DetailList, DetailSection } from "../common/DetailList";
import { formatDateTime, humanize } from "../../utils/formatters";
import { statusTone } from "../../utils/constants";

export default function BlockDrawer({ block, onClose }) {
  const { data, loading, error, run } = useApi();

  useEffect(() => {
    if (block) run(() => getBlock(block.block_id));
  }, [block, run]);

  if (!block) return null;

  return (
    <Drawer
      open={Boolean(block)}
      onClose={onClose}
      title={`Block ${block.block_code}`}
      subtitle="Infrastructure segment"
      footer={<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}
    >
      {loading && (
        <div className="state state--loading" role="status">
          <span className="spinner" />
          <p>Loading block details…</p>
        </div>
      )}

      {error && (
        <div className="state state--error" role="alert">
          <p className="state__title">Unable to load block details</p>
          <p>{error.message}</p>
          <Button size="sm" onClick={() => run(() => getBlock(block.block_id))}>Retry</Button>
        </div>
      )}

      {data && (
        <>
          <DetailSection title="Block Information">
            <DetailList
              items={[
                { label: "Block ID", value: data.block_id },
                { label: "Block Code", value: data.block_code },
                { label: "Status", value: <Badge tone={statusTone(data.status)} dot>{data.status}</Badge> },
                {
                  label: "Availability",
                  value: data.availability ? <Badge tone="green" dot>AVAILABLE</Badge> : <Badge tone="red" dot>UNAVAILABLE</Badge>,
                },
                { label: "Start Chainage", value: `${Number(data.start_chainage).toFixed(2)} km` },
                { label: "End Chainage", value: `${Number(data.end_chainage).toFixed(2)} km` },
                { label: "Length", value: `${(Number(data.end_chainage || 0) - Number(data.start_chainage || 0)).toFixed(2)} km` },
                { label: "Created", value: formatDateTime(data.created_at) },
                { label: "Updated", value: formatDateTime(data.updated_at) },
              ]}
            />
          </DetailSection>

          <DetailSection title="Location">
            <DetailList
              items={[
                { label: "Track", value: data.track?.track_code || "—" },
                { label: "Track Name", value: data.track?.track_name || "—" },
                { label: "Track Type", value: humanize(data.track?.track_type) || "—" },
                { label: "Track Gauge", value: data.track?.gauge || "—" },
                { label: "Section", value: data.track?.section?.section_code || "—" },
                { label: "Section Name", value: data.track?.section?.section_name || "—" },
              ]}
            />
          </DetailSection>
        </>
      )}
    </Drawer>
  );
}