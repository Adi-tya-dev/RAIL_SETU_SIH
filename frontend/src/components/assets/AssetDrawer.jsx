import Drawer from "../common/Drawer";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { DetailList, DetailSection } from "../common/DetailList";
import { formatDateTime, humanize } from "../../utils/formatters";
import { statusTone, CRITICALITY_TONE, LEVEL_LABEL } from "../../utils/constants";

export default function AssetDrawer({ asset, onClose }) {
  if (!asset) return null;

  return (
    <Drawer
      open={Boolean(asset)}
      onClose={onClose}
      title={`Asset ${asset.asset_code}`}
      subtitle={humanize(asset.asset_type)}
      footer={<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}
    >
      <div className="note note--info">
        Showing row data. The backend does not expose a per-asset detail endpoint yet.
      </div>

      <DetailSection title="Asset Information">
        <DetailList
          items={[
            { label: "Asset ID", value: asset.asset_id },
            { label: "Asset Code", value: asset.asset_code },
            { label: "Asset Name", value: asset.asset_name },
            { label: "Asset Type", value: humanize(asset.asset_type) },
            {
              label: "Criticality",
              value: <Badge tone={CRITICALITY_TONE[asset.criticality]}>{LEVEL_LABEL[asset.criticality]}</Badge>,
            },
            { label: "Status", value: <Badge tone={statusTone(asset.status)} dot>{asset.status}</Badge> },
            { label: "Latitude", value: asset.latitude != null ? Number(asset.latitude) : "—" },
            { label: "Longitude", value: asset.longitude != null ? Number(asset.longitude) : "—" },
            { label: "Updated", value: formatDateTime(asset.updated_at) },
          ]}
        />
      </DetailSection>

      <DetailSection title="Location">
        <DetailList
          items={[
            { label: "Block", value: asset.block?.block_code || "—" },
            { label: "Section", value: asset.section?.section_code || "—" },
            { label: "Section Name", value: asset.section?.section_name || "—" },
          ]}
        />
      </DetailSection>
    </Drawer>
  );
}