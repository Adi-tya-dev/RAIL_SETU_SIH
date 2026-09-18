import { useCallback, useEffect, useMemo, useState } from "react";
import { listSchedules, getSchedule, simulateDelay } from "../api/schedules.api";
import { isUnavailable } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import { useSystemStatus } from "../contexts/SystemStatusContext";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { NumberInput } from "../components/common/FormControls";
import SimulationResult from "../components/simulation/SimulationResult";
import { humanize } from "../utils/formatters";

export default function Simulation() {
  const toast = useToast();
  const { markSchedulingEngine } = useSystemStatus();

  const plansQuery = useApi();
  const detailQuery = useApi();

  const [planId, setPlanId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [extraDuration, setExtraDuration] = useState(30);
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState(null);
  const [engineState, setEngineState] = useState("idle");
  const [simError, setSimError] = useState(null);

  useEffect(() => {
    plansQuery.run(() => listSchedules({ limit: 100 }).then((res) => res.data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        title="What-if Simulation"
        subtitle="Evaluate the impact of maintenance changes before execution"
      />

      <div className="card">
        <div className="card__head">
          <h2>Scenario Inputs</h2>
          <p>Simulate a delay extension for a specific maintenance task inside a plan</p>
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
      </div>

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
    </>
  );
}