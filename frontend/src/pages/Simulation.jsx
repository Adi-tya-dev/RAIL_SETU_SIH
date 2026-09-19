import { useCallback, useEffect, useMemo, useState } from "react";
import { listSchedules, getSchedule, simulateDelay, simulateEmergencyReroute } from "../api/schedules.api";
import { isUnavailable } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import { useSystemStatus } from "../contexts/SystemStatusContext";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { NumberInput } from "../components/common/FormControls";
import SimulationResult from "../components/simulation/SimulationResult";
import EmergencyRerouteResult from "../components/simulation/EmergencyRerouteResult";
import { humanize } from "../utils/formatters";
import { ShieldAlert, Clock, RefreshCw, Zap } from "lucide-react";

const BLOCKS = [
  { code: "B001", name: "B001 (Delhi – Subzi Mandi · SEC-DLJP)" },
  { code: "B002", name: "B002 (Subzi Mandi – Palam · SEC-DLJP)" },
  { code: "B003", name: "B003 (Delhi Cantt – Gurgaon · SEC-DLJP)" },
  { code: "B004", name: "B004 (Ambala Cantt – Rajpura · SEC-DLAM)" },
  { code: "B005", name: "B005 (Rajpura – Sirhind · SEC-DLAM)" },
  { code: "B006", name: "B006 (Sirhind – Khanna · SEC-DLAM)" },
  { code: "B007", name: "B007 (Moradabad – Rampur · SEC-MBLK)" },
  { code: "B008", name: "B008 (Rampur – Bareilly · SEC-MBLK)" },
  { code: "B009", name: "B009 (Bareilly – Shahjahanpur · SEC-MBLK)" },
  { code: "B010", name: "B010 (Ahmedabad – Sabarmati · SEC-BCAH)" },
  { code: "B011", name: "B011 (Sabarmati – Kalol · SEC-BCAH)" },
  { code: "B012", name: "B012 (Kalol – Mehsana · SEC-BCAH)" },
  { code: "B013", name: "B013 (Pune – Lonavala · SEC-BCPN)" },
  { code: "B014", name: "B014 (Lonavala – Karjat · SEC-BCPN)" },
  { code: "B015", name: "B015 (Karjat – Kalyan · SEC-BCPN)" },
];

const EMERGENCY_REASONS = [
  { id: "RAIL_FRACTURE", label: "Rail Fracture / Flange Defect (Immediate Speed Restriction / Stop)" },
  { id: "OHE_SNAP", label: "OHE Dropper Snap / Catenary Parting (Traction Power Cut)" },
  { id: "TRACK_BUCKLING", label: "Track Buckling / Thermal Sun Kink (Derailment Risk)" },
  { id: "SIGNAL_FAILURE", label: "Relay Interlocking / Point Machine Failure (Signal Danger)" },
];

export default function Simulation() {
  const toast = useToast();
  const { markSchedulingEngine } = useSystemStatus();

  const plansQuery = useApi();
  const detailQuery = useApi();

  // Mode: "emergency" (new train rerouting) or "delay" (original plan overrun)
  const [mode, setMode] = useState("emergency");

  // Emergency simulation state
  const [emergencyBlock, setEmergencyBlock] = useState("B001");
  const [emergencyReason, setEmergencyReason] = useState("RAIL_FRACTURE");
  const [emergencyDuration, setEmergencyDuration] = useState(90);
  const [emergencySimulating, setEmergencySimulating] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState(null);

  // Original delay simulation state
  const [planId, setPlanId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [extraDuration, setExtraDuration] = useState(30);
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState(null);
  const [engineState, setEngineState] = useState("idle");
  const [simError, setSimError] = useState(null);

  useEffect(() => {
    plansQuery.run(() => listSchedules({ limit: 100 }).then((res) => res.data || []));
    // Auto-run an initial emergency simulation on B001 so the user gets instant insights
    runEmergencySimulation("B001", "RAIL_FRACTURE", 90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runEmergencySimulation(blockCode, reason, duration) {
    setEmergencySimulating(true);
    setEmergencyResult(null);
    try {
      const response = await simulateEmergencyReroute({
        block_code: blockCode,
        reason,
        duration_minutes: Number(duration),
      });
      const data = response?.data || response;
      setEmergencyResult(data);
    } catch (err) {
      toast.error(err.message || "Emergency simulation failed.");
    } finally {
      setEmergencySimulating(false);
    }
  }

  function handleEmergencySubmit(event) {
    event.preventDefault();
    runEmergencySimulation(emergencyBlock, emergencyReason, emergencyDuration);
  }

  useEffect(() => {
    if (!planId) {
      setTaskId("");
      return;
    }
    detailQuery.run(() => getSchedule(planId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const plans = (plansQuery.data || []).filter((p) => p && p.plan_id);
  const tasks = useMemo(() => {
    const list = detailQuery.data?.maintenance_tasks || [];
    return list
      .map((link) => link.maintenance_task)
      .filter((t) => t && t.maintenance_task_id);
  }, [detailQuery.data]);

  useEffect(() => {
    if (!tasks.some((t) => String(t.maintenance_task_id) === String(taskId))) {
      setTaskId("");
    }
  }, [tasks, taskId]);

  async function handleSimulate(event) {
    event.preventDefault();
    if (simulating) return;

    if (!planId || !taskId) {
      toast.warning("Select both a plan and a maintenance task.");
      return;
    }
    if (!extraDuration || Number(extraDuration) <= 0) {
      toast.warning("Enter a positive extra duration in minutes.");
      return;
    }

    setSimulating(true);
    setResult(null);
    setSimError(null);

    try {
      const response = await simulateDelay(planId, {
        task_id: String(taskId),
        extra_duration_minutes: Number(extraDuration),
      });
      const outcome = response?.data ?? response?.result ?? response ?? null;
      if (!outcome || Object.keys(outcome).length === 0) {
        setResult(null);
        setEngineState("error");
        setSimError(new Error("The simulation returned an empty result."));
        toast.error("Simulation returned an empty result.");
      } else {
        setResult(outcome);
        setEngineState("idle");
        markSchedulingEngine(true);
        toast.success("Simulation completed successfully.");
      }
    } catch (err) {
      if (isUnavailable(err)) {
        setEngineState("not_connected");
        markSchedulingEngine(false);
      } else {
        setEngineState("idle");
        setSimError(err);
        toast.error(err.message);
      }
    } finally {
      setSimulating(false);
    }
  }

  return (
    <>
      <PageHeader
        title="What-if Simulation & Rerouting"
        subtitle="Evaluate emergency track blocks, train rerouting options with stoppage maximization, and schedule delay overruns"
      />

      {/* Mode Selection Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setMode("emergency")}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: mode === "emergency" ? "1.5px solid #ef4444" : "1px solid var(--border)",
            background: mode === "emergency" ? "rgba(239, 68, 68, 0.12)" : "var(--surface)",
            color: mode === "emergency" ? "#fca5a5" : "var(--text-2)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <ShieldAlert size={16} color={mode === "emergency" ? "#ef4444" : "var(--text-3)"} />
          Emergency Track Block & Train Rerouting
        </button>

        <button
          onClick={() => setMode("delay")}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: mode === "delay" ? "1.5px solid #38bdf8" : "1px solid var(--border)",
            background: mode === "delay" ? "rgba(56, 189, 248, 0.12)" : "var(--surface)",
            color: mode === "delay" ? "#38bdf8" : "var(--text-2)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Clock size={16} color={mode === "delay" ? "#38bdf8" : "var(--text-3)"} />
          Plan Overrun & Delay Extension
        </button>
      </div>

      {/* EMERGENCY MODE CARD */}
      {mode === "emergency" && (
        <div className="card">
          <div className="card__head">
            <h2>Immediate Emergency Track Block Simulator</h2>
            <p>
              Simulate an unexpected track blockage (Rail fracture / OHE snap) to evaluate alternative train rerouting paths (Single-Line Working, Chord bypass, Platform holding) that <strong>maximize commercial passenger stoppages</strong>.
            </p>
          </div>

          <form onSubmit={handleEmergencySubmit}>
            <div className="plan-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div className="field">
                <label>Corridor Block to Close</label>
                <select
                  className="select"
                  value={emergencyBlock}
                  onChange={(e) => setEmergencyBlock(e.target.value)}
                  aria-label="Select corridor block"
                  required
                >
                  {BLOCKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Emergency Incident Reason</label>
                <select
                  className="select"
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  aria-label="Select emergency reason"
                  required
                >
                  {EMERGENCY_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <NumberInput
                label="Closure Duration (minutes)"
                min={15}
                max={480}
                value={emergencyDuration}
                onChange={(e) => setEmergencyDuration(e.target.value)}
              />

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={emergencySimulating}
                  loadingText="Evaluating Reroutes…"
                  style={{ width: "100%", background: "#ef4444", borderColor: "#dc2626" }}
                >
                  <Zap size={16} style={{ marginRight: 6 }} />
                  Simulate Emergency Rerouting
                </Button>
              </div>
            </div>
          </form>

          {emergencyResult && <EmergencyRerouteResult result={emergencyResult} />}
        </div>
      )}

      {/* DELAY OVERRUN MODE CARD */}
      {mode === "delay" && (
        <div className="card">
          <div className="card__head">
            <h2>Plan Overrun & Delay Extension</h2>
            <p>Simulate an overrun duration for a specific maintenance task inside a generated schedule</p>
          </div>

          {plansQuery.loading && (
            <div className="state state--loading" role="status">
              <span className="spinner" />
              <p>Loading plans…</p>
            </div>
          )}

          {!plansQuery.loading && plansQuery.error && (
            <div className="state state--error" role="alert">
              <p className="state__title">Unable to load plans</p>
              <p>{plansQuery.error.message}</p>
              <Button
                size="sm"
                onClick={() => plansQuery.run(() => listSchedules({ limit: 100 }).then((res) => res.data || []))}
              >
                Retry
              </Button>
            </div>
          )}

          {!plansQuery.loading && !plansQuery.error && plans.length === 0 && (
            <div className="state state--empty">
              No generated schedules yet. Create a plan on the Planning page first.
            </div>
          )}

          {!plansQuery.loading && !plansQuery.error && plans.length > 0 && (
            <form onSubmit={handleSimulate}>
              <div className="plan-form">
                <div className="field">
                  <label>Plan</label>
                  <select
                    className="select"
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    aria-label="Select plan"
                    required
                  >
                    <option value="">Select Plan</option>
                    {plans.map((p) => (
                      <option key={String(p.plan_id)} value={String(p.plan_id)}>
                        Plan {p.plan_id} — {p.block?.block_code || "N/A"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Task</label>
                  <select
                    className="select"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    aria-label="Select maintenance task"
                    disabled={!planId || detailQuery.loading}
                    required
                  >
                    <option value="">
                      {detailQuery.loading ? "Loading tasks…" : !planId ? "Select a plan first" : "Select Task"}
                    </option>
                    {tasks.map((t) => (
                      <option key={String(t.maintenance_task_id)} value={String(t.maintenance_task_id)}>
                        #{t.maintenance_task_id} · {humanize(t.maintenance_type)}
                      </option>
                    ))}
                  </select>
                </div>

                <NumberInput
                  label="Extra Duration (minutes)"
                  min={1}
                  max={1440}
                  value={extraDuration}
                  onChange={(e) => setExtraDuration(e.target.value)}
                />

                <Button type="submit" variant="primary" size="lg" loading={simulating} loadingText="Simulating…">
                  Simulate Impact
                </Button>
              </div>
            </form>
          )}

          <div className="mt-16">
            {engineState === "not_connected" && (
              <div className="not-connected" role="status">
                <p className="not-connected__title">Simulation engine is not connected yet.</p>
                <p>
                  The endpoint <span className="mono">POST /api/schedules/:id/simulate-delay</span> is
                  not available on the backend yet. No result was fabricated.
                </p>
              </div>
            )}

            {engineState === "error" && simError && (
              <div className="not-connected" role="alert">
                <p className="not-connected__title" style={{ color: "var(--red)" }}>
                  Simulation failed
                </p>
                <p>{simError.message}</p>
              </div>
            )}

            {result && <SimulationResult result={result} />}

            {engineState === "idle" && !result && !simError && plans.length > 0 && (
              <div className="not-connected">
                <p className="not-connected__title">Ready</p>
                <p>
                  Configure a scenario and run the simulation. Results will be rendered from the real
                  backend response.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}