import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { getLatestSync, runIntegrationSync } from "../../api/integration.api";
import { useApiQuery } from "../../hooks/useApi";
import { useToast } from "../../contexts/ToastContext";
import { SOURCE_NAMES, SOURCE_LABEL, SOURCE_TONE, statusTone } from "../../utils/constants";
import { formatDateTime } from "../../utils/formatters";
import Card from "../common/Card";
import Button from "../common/Button";
import Badge from "../common/Badge";

export default function SourceSyncBar({ onSynced }) {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const { data, loading, reload } = useApiQuery(getLatestSync, []);

  const run = data?.data ?? null;
  const status = run && run.status !== "RUNNING" ? run.status : null;

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await runIntegrationSync();
      const runData = res?.data ?? {};
      const records = runData.summary
        ? Object.values(runData.summary).reduce(
            (acc, s) => acc + (s && (s.imported || 0)) + (s && (s.updated || 0)),
            0
          )
        : 0;
      const overall = runData.status || "COMPLETED";
      toast.success(
        overall === "FAILED"
          ? "Source sync finished with failures — check the run details."
          : `Source data synchronized: ${records} record(s) imported or updated.`
      );
      if (onSynced) onSynced();
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card
      title="Source Data Integration"
      subtitle="Railway source systems connected through adapters and simulators"
      actions={
        <Button
          variant="primary"
          size="sm"
          icon={RefreshCcw}
          loading={syncing}
          loadingText="Syncing…"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Syncing…" : "Run Sync"}
        </Button>
      }
    >
      <div className="pill-list" style={{ alignItems: "center" }}>
        {SOURCE_NAMES.map((code) => (
          <Badge key={code} tone={SOURCE_TONE[code]}>
            {code}
          </Badge>
        ))}
        <span className="cell-muted" style={{ marginLeft: 8 }}>
          {SOURCE_NAMES.map((code) => SOURCE_LABEL[code]).join(" · ")}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
        <Badge tone="cyan">SIMULATOR</Badge>
        <span className="cell-muted">Simulated source data for prototype — not live railway data.</span>
        {loading ? (
          <span className="spinner spinner--xs" aria-hidden="true" />
        ) : run ? (
          <>
            <span className="cell-muted" style={{ marginLeft: 4 }}>Last sync:</span>
            <Badge tone={status ? statusTone(status) : "amber"} dot>
              {status || "RUNNING"}
            </Badge>
            <span className="cell-muted">{formatDateTime(run.completed_at || run.started_at)}</span>
          </>
        ) : (
          <span className="cell-muted" style={{ marginLeft: 4 }}>No sync run yet.</span>
        )}
      </div>
    </Card>
  );
}