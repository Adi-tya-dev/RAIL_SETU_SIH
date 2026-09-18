# RailSetu Backend

Backend for **SIH 2026 - Problem Statement SIH26027: AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways**.

RailSetu combines maintenance requirements, railway infrastructure/block availability, and train movements to automatically generate optimized maintenance block plans.

Current stage: **backend foundation + PostgreSQL (Prisma) + deterministic demo seed + read APIs + a built-in heuristic scheduling/simulation engine + full React control-room frontend**. The complete Frontend → Express → heuristic engine → Prisma → PostgreSQL flow is working with real data: plans can be generated, persisted, listed, inspected, and simulated.

> **Note:** The scheduling engine currently runs **in-process in Node** (`Backend/src/algorithms/`). The plug point for an external (e.g. Python) engine is still reserved via `ALGORITHM_DIR` / `ALGORITHM_ENTRY`; when those are set the adapter logs a warning and falls back to the built-in engine. See `docs/algorithm-integration.md`.

## Tech Stack

- Node.js
- Express
- JavaScript (CommonJS)
- PostgreSQL
- Prisma ORM
- dotenv (environment variables)
- cors
- nodemon (development only)

## Repository Layout

```
├── Backend/          # Node.js + Express + Prisma backend + built-in scheduling engine
└── frontend/         # React + Vite control-room UI (Dashboard, Planning, Schedules, Conflicts, Simulation)
```

## Prerequisites

- Node.js (v18 or later recommended)
- npm
- Docker Desktop (used to run local PostgreSQL 16)

> PostgreSQL runs in Docker for **local development/demo only**. Do not expose port `5432` publicly in a real deployment.

---

## Backend

### Installation

```bash
cd Backend
npm install
```

### Database Setup (Docker PostgreSQL)

The repo root contains `docker-compose.yml` which starts PostgreSQL 16 with:

| Setting | Value |
| ------- | ----- |
| Container | `railsetu-postgres` |
| Image | `postgres:16` |
| Database | `railway_block_planning` |
| User / password | `postgres` / `postgres` |
| Port | `5432` |
| Data volume | `postgres_data` (persists across restarts) |

1. **Start PostgreSQL** (from the repo root, where `docker-compose.yml` lives):

   ```bash
   docker compose up -d
   ```

   Verify the container is healthy and the database accepts connections:

   ```bash
   docker ps
   docker exec railsetu-postgres pg_isready -U postgres -d railway_block_planning
   ```

   > **Stop PostgreSQL** (data is preserved in the `postgres_data` volume):

   ```bash
   docker compose stop      # stop the container
   docker compose down      # stop and remove the container (volume kept)
   ```

   > **Remove data too** (destructive, local dev only):

   ```bash
   docker compose down -v
   ```

2. **Configure environment** — copy `.env.example` to `.env` and set `DATABASE_URL`:

   ```
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/railway_block_planning?schema=public"
   ```

   `.env` is git-ignored. `.env.example` contains placeholders only.

3. **Validate the schema and generate the Prisma client**:

   ```bash
   npx prisma validate
   npx prisma generate
   ```

4. **Apply migrations** (creates the 16 application tables in an empty database):

   ```bash
   npx prisma migrate dev --name init
   ```

   > Do **not** run `prisma migrate reset` or any DROP command as part of normal setup. The Prisma schema (`prisma/schema.prisma`) is the source of truth.

5. **Seed demo data**:

   ```bash
   npm run db:seed
   ```

   This runs `prisma/seed.js` via the `prisma.seed` config. It is deterministic and idempotent — if the demo data (`NR` zone) already exists it skips, so re-running does not create duplicates. It never deletes existing data.

   > To wipe and reseed locally, drop the volume (`docker compose down -v`), re-run `docker compose up -d`, apply the migration, and seed again. Do this only for local development.

> PostGIS is not required; assets use `latitude`/`longitude` plus `block_id`/`section_id`/chainage as prototype location data.

### Running the Development Server

```bash
npm run dev
```

Runs the server with **nodemon**, which automatically restarts on file changes.

### Running the Server

```bash
npm start
```

Runs the server normally with Node.js.

Server listens on `http://localhost:5000` by default.

### API Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/health` | Backend status |
| GET | `/api/health/db` | Database connectivity |
| GET | `/api/maintenance` | List maintenance tasks |
| GET | `/api/maintenance/:id` | One maintenance task (with asset, block, section) |
| GET | `/api/blocks` | List blocks |
| GET | `/api/blocks/:id` | One block (with track + section) |
| GET | `/api/trains` | List trains |
| GET | `/api/trains/:id` | One train (with routes + block movements) |
| GET | `/api/assets` | List assets (with block, section) |
| GET | `/api/dashboard/summary` | Counts across maintenance, blocks, trains, assets, plans |
| GET | `/api/schedules` | List generated block plans |
| GET | `/api/schedules/:id` | One plan with tasks, train impacts, conflicts, operations |
| POST | `/api/schedules/generate` | Run the scheduler for a window and persist the resulting plans |
| POST | `/api/schedules/:id/simulate-delay` | What-if simulation of extending one task in a plan |

### List Endpoint Query Parameters

Common:

- `?page=1` — page number (positive integer, default 1)
- `?limit=20` — page size (max 100, default 20)

Per-endpoint filters (invalid values return `400`):

- `/api/maintenance`: `department`, `status`, `priority` (1-4), `block_id`, `section_id`
- `/api/blocks`: `status`, `availability` (true/false), `section_id`
- `/api/trains`: `status`, `priority` (1-4)
- `/api/assets`: `status`, `criticality` (1-4), `block_id`, `section_id`

### Example Requests

```bash
# List maintenance tasks, page 1, 20 per page
curl "http://localhost:5000/api/maintenance?page=1&limit=20"

# Filter maintenance by department and status
curl "http://localhost:5000/api/maintenance?department=ENGINEERING&status=PENDING"

# One maintenance task
curl "http://localhost:5000/api/maintenance/1"

# Blocks available for maintenance on section 1
curl "http://localhost:5000/api/blocks?status=AVAILABLE&availability=true&section_id=1"

# Trains with high priority
curl "http://localhost:5000/api/trains?priority=4"

# Defective critical assets
curl "http://localhost:5000/api/assets?status=DEFECTIVE&criticality=4"
```

### Response Format

List success:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Detail success:

```json
{
  "success": true,
  "data": { ... }
}
```

Error:

```json
{
  "success": false,
  "message": "..."
}
```

Status codes: `200` success, `400` invalid query parameters, `404` resource not found, `500` internal server error. Internal details (Prisma errors, DB credentials, stack traces) are never exposed to clients; BigInt IDs are serialized as strings.

---

## Scheduling & Simulation Engine

The scheduler is a deterministic, single-pass heuristic engine in `Backend/src/algorithms/`:

- `scheduling.engine.js` — groups eligible maintenance tasks per block and consolidates them into
  a single **mega block** closure (one `BlockPlan`), applying a 15-minute coordination buffer per
  extra department. Tasks are prioritised by `priority·3 + criticality·2 + urgency·2`, then
  earliest deadline, then shortest duration.
- `conflict.util.js` — detects train movements that overlap the closure (10-minute buffer) and
  reports them as `TRAIN_MAINTENANCE` conflicts, with severity derived from the train priority
  and overlap duration. Multiple movements of the same train are aggregated into one impact.
- `simulation.engine.js` — recomputes the same conflict model for an extended window and returns
  the additional delay and newly introduced conflicts. Simulations are **not persisted**.

### `POST /api/schedules/generate`

Request body:

```json
{ "start": "2026-09-18T00:00:00.000Z", "end": "2026-09-25T00:00:00.000Z" }
```

Behaviour:

- Only `PENDING` / `APPROVED` tasks are considered.
- Tasks with no block, an unavailable block, an invalid duration, a duration longer than the window,
  or an unreachable deadline are returned in `unscheduled_tasks` with a reason
  (`NO_BLOCK`, `BLOCK_UNAVAILABLE`, `INVALID_DURATION`, `EXCEEDS_WINDOW`, `DEADLINE_VIOLATION`).
- Preferred times and deadlines are anchored into the planning window by preserving the **time of
  day** (e.g. a preferred 10:00 on a past date is scheduled at 10:00 on the first day of the window).
  Train movements are projected onto the plan day the same way, modelling daily services.
- On success the engine's mega blocks, task links, train impacts and conflicts are written inside a
  single Prisma transaction as `PROPOSED` plans.

Success (`201`) — the response is a flat plan summary plus the detail arrays:

```json
{
  "success": true,
  "data": {
    "plan_id": "1",
    "plan_ids": ["1"],
    "planning_window": { "start": "...", "end": "..." },
    "optimization_score": 0.87,
    "asset_availability_score": 0.98,
    "tasks_scheduled": 8,
    "tasks_unscheduled": 6,
    "mega_block_count": 8,
    "conflict_count": 3,
    "affected_train_count": 3,
    "estimated_delay_minutes": 95,
    "scheduled_duration_minutes": 1290,
    "mega_blocks": [
      {
        "block_code": "B001",
        "task_count": 3,
        "departments": ["ENGINEERING", "SIGNAL", "TRACTION"],
        "planned_start": "...",
        "planned_end": "...",
        "optimization_score": 0.82,
        "reason": ["..."]
      }
    ],
    "scheduled_tasks": [ "..." ],
    "unscheduled_tasks": [{ "maintenance_task_id": "8", "reason": "BLOCK_UNAVAILABLE" }],
    "train_impacts": [{ "train_id": "1", "train_number": "12301", "estimated_delay_minutes": 15 }],
    "conflicts": [{ "conflict_type": "TRAIN_MAINTENANCE", "severity": 4, "train_number": "12301" }]
  }
}
```

Invalid or missing dates, or an `end` not after `start`, return `400`.

### `POST /api/schedules/:id/simulate-delay`

Request body:

```json
{ "task_id": "1", "extra_duration_minutes": 30 }
```

Returns the original vs new plan end, the additional delay, the new affected trains, the conflicts
newly introduced by the extension, and an `updated_plan` preview. Nothing is written to the
database. `400` if the task is not part of the plan or the extra duration is invalid; `404` if the
plan does not exist.

---

## Frontend (Control-Room UI)

A React + Vite single-page app with client-side routing. It talks to the backend at
`VITE_API_URL` (default `http://localhost:5000/api`) and renders loading / error / empty states
for every request.

### Installation

```bash
cd frontend
npm install
```

### Running the Development Server

```bash
npm run dev
```

Opens on `http://localhost:5173`. The backend must be running on `http://localhost:5000` (CORS is enabled).

### Build

```bash
npm run build
```

Creates a production build in `frontend/dist`.

### Pages

- **Dashboard** — operation summary cards and distributions.
- **Maintenance / Blocks / Trains / Assets** — filterable, paginated tables with detail drawers.
- **Planning** — pick a window and call `POST /api/schedules/generate`; renders plan metrics and mega blocks.
- **Schedules** — list and inspect persisted plans (tasks, impacts, conflicts, operations, metrics).
- **Conflicts** — aggregates conflicts across loaded plans and highlights open/critical ones.
- **Simulation** — choose a plan and task, extend its duration, and view the simulated impact.

---

## Demo Seed Scenario

`npm run db:seed` creates a small, realistic railway network using stable codes so the scenario is reproducible:

| Entity | Count | Notes |
| ------ | ----- | ----- |
| Zones | 2 | NR, WR |
| Divisions | 3 | DLI, MZP, BCT |
| Sections | 5 | including SEC-DLJP, SEC-DLAM, SEC-MBLK, SEC-BCAH, SEC-BCPN |
| Stations | 12 | NDLS, DEE, DLI, BGZ, UMB, MB, BE, LKO, BCT, ST, ADI, PUNE |
| Tracks | 6 | TR-001 … TR-006 |
| Blocks | 15 | B001 … B015; **B012 is `UNDER_REPAIR` / unavailable** |
| Trains | 10 | including 12301 Howrah Rajdhani, 12951 Mumbai Rajdhani |
| Train routes | 24 | covers all trains |
| Train block movements | 14 | multiple trains share blocks |
| Assets | 15 | track panels, OHE masts, signals |
| Maintenance tasks | 20 | mixed departments / priorities / durations |

### Core RailSetu scenarios baked into the seed

- **Mega Block candidate** — three tasks on the **same block `B001`** with overlapping windows:
  - `ENGINEERING` — Track Realignment (priority 4, criticality 4, urgency 4, 120 min)
  - `TRACTION` — OHE Wire Replacement (priority 3, criticality 3, urgency 3, 90 min)
  - `SIGNAL` — Signal Calibration (priority 3, criticality 4, urgency 3, 60 min)
- **Train–maintenance conflict** — train `12301` passes block `B001` at `11:00–11:15`, overlapping the `B001` maintenance window (around `10:00–12:00`). The future algorithm can detect `TRAIN_MAINTENANCE`. No delay is calculated in the seed.
- **Other cases** — high-criticality signalling task (`B010`), low-priority routine inspection (`B004`), deadline-sensitive traction task (`B007`), maintenance on the unavailable block `B012`, multiple trains through the same block (`B007`, `B010`, `B011`), varied durations (30–480 min), and deliberately incompatible tasks (same block, different departments).

> The seed does **not** implement Mega/Shadow Block logic or conflict detection. Mega/Shadow Blocks are scheduling concepts, not database tables; the algorithm decides consolidation later.

## API Testing

With PostgreSQL running, the backend started, and the seed applied, all read endpoints return real data:

```bash
curl "http://localhost:5000/api/health"
curl "http://localhost:5000/api/health/db"
curl "http://localhost:5000/api/maintenance?department=ENGINEERING"
curl "http://localhost:5000/api/maintenance?priority=4"
curl "http://localhost:5000/api/maintenance?limit=5"
curl "http://localhost:5000/api/blocks?availability=true"
curl "http://localhost:5000/api/trains?priority=3"
curl "http://localhost:5000/api/assets?criticality=4"
```

Detail endpoints accept a real seeded ID (BigInt IDs are returned as strings, e.g. `"1"`):

```bash
curl "http://localhost:5000/api/maintenance/1"
curl "http://localhost:5000/api/blocks/1"
curl "http://localhost:5000/api/trains/1"
```

## PostgreSQL Troubleshooting

If PostgreSQL is not running, the read APIs behave as follows:

- `GET /api/health` still works.
- `GET /api/health/db` and all data endpoints return a sanitized HTTP 500 (`{"success":false,"message":"Internal Server Error"}`) — no credentials or internal errors are exposed.
- Validation errors (invalid filters/pagination) still return `400`.

Start PostgreSQL with `docker compose up -d` and confirm with `docker ps`.

## Roadmap

Done in this phase:

- `POST /api/schedules/generate` with a built-in heuristic engine, persisted via a Prisma transaction.
- Mega-block consolidation (one `BlockPlan` per block, multiple departments).
- Train-vs-maintenance conflict detection with severity and estimated delay.
- `POST /api/schedules/:id/simulate-delay` what-if simulation (read-only).

Remaining:

- Write/CRUD APIs for maintenance tasks, blocks, trains, assets.
- Connect the external engine (`ALGORITHM_DIR` / `ALGORITHM_ENTRY`) using the contract in `docs/algorithm-integration.md`.
- Conflict resolution / acknowledgement workflows and `BlockOperation` (post-execution) capture.
- Shadow-block planning, plan approve/cancel lifecycle, and persisted simulations.
- What-if scenarios beyond a single task extension (block swaps, task re-assignment).