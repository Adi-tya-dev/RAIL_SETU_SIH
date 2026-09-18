# Algorithm Integration Contract (DRAFT)

> **Status: Integration contract — external engine pending; built-in engine active**

This document defines the contract boundary between the RailSetu backend and a future
scheduling/optimization engine. It is intentionally a DRAFT. Nothing here is locked
until the algorithm teammate confirms their actual implementation.

A deterministic **built-in Node heuristic engine** (`Backend/src/algorithms/`) now fills
both methods so the product is end-to-end functional. When `ALGORITHM_DIR` and
`ALGORITHM_ENTRY` are set, the adapter logs a warning that the external engine is not yet
wired and still uses the built-in engine. Compare the teammate's delivered engine against
this contract before wiring it up.

---

## 1. Scope

The backend will call the engine to produce maintenance block schedules and, later,
what-if simulations. This document only defines the data contract between the two
systems — the input the backend can provide and the output the backend expects.

Implementation details (Python execution, HTTP calls, subprocess, Docker, packaging)
are intentionally NOT specified and NOT locked here.

## 2. Plug point (structure only)

The adapter lives at `Backend/src/services/algorithm.service.js`.

It exposes two methods:

```
generateSchedule(input)     // full scheduling run
simulateWhatIf(input)       // simulation of scheduling alternatives
```

Today both delegate to the built-in engine in `Backend/src/algorithms/`. When the external
engine is configured it plugs into these two methods, replacing the built-in implementation.

## 3. Inputs the backend can provide

The backend can assemble, from PostgreSQL, the following shape for a scheduling run:

| Field              | Source (Prisma model)                 | Meaning                                    |
| ------------------ | ------------------------------------- | ------------------------------------------ |
| `planning_window`  | caller-provided start/end timestamps  | Time window to schedule against            |
| `maintenance_tasks`| `MaintenanceTask`                     | Requests with duration, window, priority   |
| `blocks`           | `Block` (+ `Track`, `Section`)        | Physical segments that can be closed       |
| `assets`           | `Asset`                               | Assets needing maintenance                 |
| `train_movements`  | `TrainBlockMovement` (+ `Train`)      | Scheduled train passage through blocks     |

## 4. Outputs the backend expects

The backend expects the engine to return the following shape:

| Field               | Target (Prisma model)                 | Meaning                                   |
| ------------------- | ------------------------------------- | ----------------------------------------- |
| `mega_blocks`       | `BlockPlan`                           | Proposed block closure plans               |
| `scheduled_tasks`   | `PlanMaintenanceTask` mapping         | Maintenance tasks assigned to plans        |
| `unscheduled_tasks` | (report only, no write)               | Tasks that could not be scheduled          |
| `train_impacts`     | `PlanTrainImpact`                     | Expected delay estimates per train         |
| `conflicts`         | `BlockConflict`                       | Conflicts detected (plan vs train, dept)   |
| `metrics`           | `BlockPlan.optimization_score` + summary | Plan quality / availability metrics     |

## 5. Contract rules

- The backend treats the engine as a black box; a single input in, structured output out.
- All timestamps are ISO-8601 UTC strings.
- All numeric IDs are strings (BigInt).
- The engine MUST NOT write directly to the database. Schema writes are owned by the
  backend inside a Prisma transaction (`Backend/src/services/transaction.service.js`).
- Error behavior: if the engine fails, the backend returns a sanitized `500`
  (never raw engine output, stack traces, or SQL).

## 6. Open questions for the algorithm teammate

- Expected input size and batching limits per call.
- Whether the engine is synchronous or async (job-based) — the current contract
  assumes a synchronous call with a timeout (`ALGORITHM_TIMEOUT_MS`).
- Exact naming of output fields — adjust section 4 before implementation.
- What "metrics" should contain precisely.

## 7. Configuration placeholders

Already reserved in `Backend/src/config/env.js` (not required for backend to start):

```
ALGORITHM_DIR
ALGORITHM_ENTRY
ALGORITHM_TIMEOUT_MS
```