# RailSetu — Work Report (SIH 2026 · PS SIH26027)

**Problem Statement:** AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways.

**Date:** 18 September 2026

---

## 1. Overview

RailSetu is a full-stack prototype that combines maintenance requirements, railway infrastructure/block availability, and train movements to automatically generate optimized maintenance **block plans** (including **mega blocks**). The complete flow — **React frontend → Express API → heuristic scheduling engine → Prisma → PostgreSQL** — is functional end-to-end with real data: plans can be generated, persisted, listed, inspected, and what-if simulated.

No git repository has been initialized; all work exists on local disk under `E:\SIH`.

---

## 2. What Has Been Built

### 2.1 Backend (`Backend/`)

- **Node.js + Express 5** REST API (CommonJS), PostgreSQL 16 via **Docker Compose**, **Prisma ORM**.
- **Database schema** (`prisma/schema.prisma`): **19 models / tables** —
  Zones, Divisions, Sections, Stations, Tracks, Blocks, Trains, TrainRoutes, TrainBlockMovements, Assets, MaintenanceTasks, BlockPlans, PlanMaintenanceTasks, PlanTrainImpacts, BlockConflicts, BlockOperations, SourceSyncRuns, SourceRecords, GoodsTrainForecasts.
- **Two migrations applied:**
  - `20260915141252_init` — base railway schema (16 tables, indexes, FKs).
  - `20260918120000_source_data_integration` — source-field columns on `maintenance_tasks`, `source_sync_runs`, `source_records` provenance ledger, `goods_train_forecasts` (COA).
- **API routes / controllers / services:** health (2), maintenance, blocks, trains, assets, schedules, dashboard, integration — full CRUD-read layer with **pagination, filtering, validation (400s), sanitized 500s**, and **BigInt serialized to strings**.
- **Middleware:** request logger, JSON serializer, centralized error handler.

### 2.2 Scheduling & Simulation Engine (`Backend/src/algorithms/`)

- **`scheduling.engine.js`** — deterministic single-pass heuristic: groups eligible maintenance tasks per block and consolidates them into single **mega block** closures (`BlockPlan`), applying a 15-min coordination buffer per extra department. Tasks prioritized by `priority·3 + criticality·2 + urgency·2`, then earliest deadline, then shortest duration.
- **`conflict.util.js`** — detects train movements overlapping a closure (10-min buffer) as `TRAIN_MAINTENANCE` conflicts with severity from train priority + overlap; aggregates multiple movements per train.
- **`simulation.engine.js`** — read-only what-if: recomputes delay/conflicts for an extended task duration. Simulations are never persisted.
- **Persisted via Prisma transaction** through `transaction.service.js`.
- **External engine plug point reserved** (`ALGORITHM_DIR` / `ALGORITHM_ENTRY` / `ALGORITHM_TIMEOUT_MS`); contract documented in `docs/algorithm-integration.md`. Backend currently falls back to the built-in engine.

### 2.3 Source-System Data Integration (`Backend/src/integration/`)

- **Four simulated source systems** (explicitly marked "not live railway data"):
  - **TMS** — Track Maintenance System (Engineering)
  - **SMMS** — Signalling & Telecom Maintenance System (Signalling)
  - **TDMS** — Traction Distribution Maintenance System (Traction)
  - **COA** — Corridor Operations & Availability (block availability, timetable, goods-train forecast)
- **Simulators** (`tms`, `smms`, `tdms`, `maintenance`, `coa`) + source adapters (`base.source`, `maintenance.source`, `coa.source`, `registry`).
- **Sync orchestration:** `POST /api/integration/sync` runs a ledgered sync (`SourceSyncRun`) that imports records with **full provenance** (`SourceRecord`: source, source_ref, payload). Endpoints for sync history, latest sync, errors, incoming requests, and COA data.
- Config-driven `SOURCE_MODE=SIMULATOR`/`LIVE`.

### 2.4 Seed Data (`Backend/prisma/`)

- **`seed.js`** (deterministic + idempotent): NR/WR zones, 3 divisions, 5 sections, 12 stations, 6 tracks, 15 blocks (one unavailable), 10 trains, 24 routes, 14 block movements, 15 assets, 20 maintenance tasks.
- Scenario cases baked in: **mega-block candidate** (3 departments on block B001), train–maintenance conflict (12301 vs B001), deadline-sensitive, high-criticality, unavailable-block, and incompatible-task cases.
- Additional scenario seeds: `seed-sanghamitra.js`, `seed-longdistance.js`, `seed-priority.js`.

### 2.5 Tests (`Backend/test/`)

Suit of `node --test` suites: `unit.test.js`, `integration.test.js`, `engine.test.js`, `api.test.js` — covering validation utilities, endpoints (200/400/404), BigInt serialization, schedule generation and simulate-delay flows.

### 2.6 Frontend (`frontend/`)

- **React 18 + Vite 6** SPA with client-side routing; **React Leaflet** (railway map), **Recharts** (dashboards), **lucide-react** icons.
- **13 pages:** Dashboard, Maintenance, Blocks, Trains, Assets, Planning, Schedules, Incoming Requests, COA Data, Conflicts, Simulation, Railway Map, Train Impacts (+ NotFound).
- Full **control-room feature set:** filterable/paginated tables with detail drawers, one-click plan generation over a chosen window, plan inspection (tasks/impacts/conflicts/metrics), conflict aggregation with open/critical highlighting, and task-duration simulation.
- **Reusable component library** (`common/`), layout (Sidebar/Header/AppLayout), domain components per feature, **API modules** per domain, custom hooks (`useApi`, `useReferenceData`, `useRoute`), Toast + SystemStatus contexts.
- Geo data (`public/geo/india-states.geojson`, `india-districts.geojson`) for the map.
- Production build present in `frontend/dist/`.

---

## 3. Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 18, Vite 6, React Router (custom hook), React Leaflet, Recharts, Lucide |
| Backend | Node.js, Express 5, CommonJS |
| Database | PostgreSQL 16 (Docker), Prisma ORM |
| Engine | Built-in deterministic Node heuristic (external plug-point reserved) |
| Source data | Simulated TMS / SMMS / TDMS / COA with provenance ledger |

---

## 4. Current Status

| Area | Status |
| ---- | ------ |
| Database schema + migrations | Done (19 tables, 2 migrations) |
| Read APIs (health, maintenance, blocks, trains, assets, dashboard) | Done |
| Plan generation + persistence | Done (`POST /api/schedules/generate`) |
| Mega-block consolidation | Done |
| Train–maintenance conflict detection | Done |
| What-if simulation | Done (`POST /api/schedules/:id/simulate-delay`) |
| Source-system integration (4 sources, simulators, provenance) | Done |
| COA data (block availability, timetable, goods forecast) | Done |
| Frontend control-room UI (13 pages) | Done |
| Tests | Done |
| External (AI/Python) engine | Not wired — contract drafted, built-in engine active |

---

## 5. Remaining / Roadmap

- Write/CRUD APIs for maintenance tasks, blocks, trains, assets.
- Connect the external engine per `docs/algorithm-integration.md`.
- Conflict resolution / acknowledgement workflows; `BlockOperation` (post-execution) capture.
- Shadow-block planning, plan approve/cancel lifecycle, persisted simulations.
- What-if beyond single task extension (block swaps, task reassignment).

---

## 6. How to Run

```bash
# 1. PostgreSQL
docker compose up -d

# 2. Backend
cd Backend
npm install
npx prisma migrate dev   # apply migrations
npm run db:seed          # deterministic demo data
npm run dev              # http://localhost:5000

# 3. Frontend
cd frontend
npm install
npm run dev              # http://localhost:5173
```