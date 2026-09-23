import { useEffect, useState } from "react";
import { generateSchedule } from "../api/schedules.api";
import { isUnavailable } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { useSystemStatus } from "../contexts/SystemStatusContext";
import { todayPlusDays, fromLocalInputValue } from "../utils/formatters";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import StateBlock from "../components/common/StateBlock";
import { CalendarCog, Zap, ArrowRight, AlertCircle, CheckCircle2, Clock, Train, Wrench, Loader2 } from "lucide-react";
import PlanResult from "../components/planning/PlanResult";
import ScheduleDetail from "../components/schedules/ScheduleDetail";

const GENERATE_STEPS = [
  "Analyzing maintenance tasks...",
  "Checking block availability...",
  "Evaluating train movements...",
  "Detecting compatible maintenance...",
  "Building coordinated blocks...",
  "Calculating operational impact...",
];

const LOGIC_STEPS = [
  { title: "Maintenance Priority Score", desc: "Priority weight + criticality + urgency + deadline risk" },
  { title: "Deadline Compliance", desc: "Tasks approaching deadline are scheduled first" },
  { title: "Block Availability", desc: "Only blocks with availability=true are considered" },
  { title: "Compatible Task Grouping", desc: "Same physical block + overlapping windows = Mega Block candidate" },
  { title: "Train Movement Conflicts", desc: "Detected when trainEntry < maintenanceEnd AND trainExit > maintenanceStart" },
  { title: "Operational Impact", desc: "Estimated delay calculated from blocked interval and movement timing" },
  { title: "Asset Availability Score", desc: "Considers asset criticality and current status" },
];

export default function Planning() {
  const toast = useToast();
  const { markSchedulingEngine } = useSystemStatus();

  const [startDate, setStartDate] = useState(todayPlusDays(1));
  const [endDate, setEndDate] = useState(todayPlusDays(7));
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [engineState, setEngineState] = useState("idle");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (engineState !== "generating") {
      setStepIndex(0);
      return;
    }
    setStepIndex(0);
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < GENERATE_STEPS.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [engineState]);

  async function handleGenerate(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (generating) return;

    if (!startDate || !endDate) {
      toast.warning("Select both a start and end date.");
      return;
    }
    if (endDate < startDate) {
      toast.warning("End date must be on or after the start date.");
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);
    setEngineState("generating");

    try {
      const response = await generateSchedule({
        start: fromLocalInputValue(startDate),
        end: fromLocalInputValue(endDate),
      });
      const plan = response?.data ?? response?.plan ?? response ?? null;
      if (!plan) {
        setEngineState("empty");
        setError(new Error("The scheduling engine returned an empty plan."));
      } else {
        setResult(plan);
        setEngineState("success");
        markSchedulingEngine(true);
        toast.success("Optimized plan generated successfully.");
      }
    } catch (err) {
      if (isUnavailable(err)) {
        setEngineState("not_connected");
        markSchedulingEngine(false);
      } else {
        setEngineState("error");
        setError(err);
        toast.error(err.message);
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Custom Window Block Generator"
        subtitle="Generate on-demand coordinated maintenance blocks for a specific operational date range and corridor window"
      />

      <section className="card">
        <div className="card__head">
          <h2>Target Planning Window</h2>
          <p>Select the specific date range to compute dynamic block allocations and traffic gap opportunities</p>
        </div>
        <form onSubmit={handleGenerate}>
          <div className="plan-form">
            <div className="field">
              <label>Start Date</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={todayPlusDays(0)}
                required
              />
            </div>
            <div className="field">
              <label>End Date</label>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
            <div className="field plan-form__actions">
              <Button type="submit" variant="primary" size="xl" loading={generating} loadingText="Generating...">
                <Zap size={16} />
                GENERATE OPTIMIZED PLAN
              </Button>
            </div>
          </div>
          <p className="text-xs text-faint plan-form__note">
            This simulation does not call any AI service. The scheduling engine uses deterministic heuristics.
          </p>
        </form>
      </section>

      <div className="mt-16">
        {engineState === "generating" && (
          <div className="card">
            <div className="card__body">
              <p className="font-bold text-accent" style={{ marginBottom: "var(--s5)", fontSize: 15 }}>
                Building Optimized Plan...
              </p>
              <div className="progress-steps">
                {GENERATE_STEPS.map((label, i) => {
                  const isDone = i < stepIndex;
                  const isActive = i === stepIndex;
                  return (
                    <div
                      key={label}
                      className={`progress-step${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
                    >
                      <span className="progress-step__dot" />
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {engineState === "not_connected" && (
          <div className="not-connected" role="status">
            <p className="not-connected__title">Planning Engine Unavailable</p>
            <p>
              The endpoint <span className="mono">POST /api/schedules/generate</span> is not reachable. No plan
              was generated — nothing is being simulated here.
            </p>
            <div style={{ marginTop: "var(--s4)" }}>
              <Button variant="secondary" size="sm" loading={generating} loadingText="Generating..." onClick={handleGenerate}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {engineState === "error" && error && (
          <div className="not-connected" role="alert">
            <p className="not-connected__title" style={{ color: "var(--red)" }}>
              Unable to Generate a Plan
            </p>
            <p>{error.message}</p>
            <div style={{ marginTop: "var(--s4)" }}>
              <Button variant="secondary" size="sm" onClick={() => setEngineState("idle")}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {engineState === "empty" && (
          <div className="not-connected" role="status">
            <p className="not-connected__title">Plan Output Was Empty</p>
            <p>The scheduling engine returned an empty plan. Try adjusting the planning window.</p>
          </div>
        )}

        {engineState === "success" && result && (
          <PlanResult plan={result} onSelectPlan={setSelectedPlanId} />
        )}

        {engineState === "idle" && (
          <div className="card">
            <div className="card__head">
              <h2>Rule-based Planning Logic</h2>
              <p>
                RailSetu uses deterministic rule-based planning. The scheduling engine applies these criteria in order:
              </p>
            </div>
            <div className="card__body">
              <div className="logic-steps">
                {LOGIC_STEPS.map((step, i) => (
                  <div className="logic-step" key={step.title}>
                    <div className="logic-step__num">{i + 1}</div>
                    <div className="logic-step__text">
                      <strong>{step.title}</strong> — {step.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ScheduleDetail planId={selectedPlanId} onClose={() => setSelectedPlanId(null)} />
    </>
  );
}