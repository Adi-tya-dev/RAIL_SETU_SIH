# RailSetu — AI-Powered Automatic Block Planning System

> **Smart India Hackathon (SIH)** · Problem Statement: **SIH26027**  
> **Theme:** AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways.

RailSetu is a decision-support and automatic block scheduling platform for Indian Railways. It automatically consolidates cross-departmental maintenance demands (Track/Engineering, Signalling & Telecom, Traction Distribution) into synchronized **Mega Blocks**, detects train–maintenance traffic conflicts, computes delay impacts, and provides real-time emergency train rerouting around corridor closures.

---

## 🌟 Key Features

- **Mega-Block Consolidation Engine**: Groups disparate maintenance requests across Engineering (TMS), Signalling (SMMS), and Traction (TDMS) into synchronized shadow windows to minimize corridor disruption.
- **Conflict Detection & Delay Analytics**: Detects train movement overlaps, evaluates priority-weighted delays, and computes passenger/freight impact scores.
- **Authentic GIS Railway Track Map**: Interactive Leaflet-based map visualizing actual Indian Railways corridor geometry, stations, live train positions, block statuses, and diversion routes.
- **Emergency Train Rerouting**: Dijkstra & heuristic pathfinding for dynamic train rerouting during sudden track closures or extended maintenance windows.
- **Live Pub/Sub Integration Stream**: Server-Sent Events (SSE) stream simulating real-time feeds from TMS, SMMS, TDMS, and COA with on-demand request injection for prototype demonstrations.
- **Two-Horizon Planning**: Supports both tactical weekly horizons and strategic monthly maintenance windows.

---

## 🏗️ Technology Stack

- **Frontend**: React 18, Vite, React-Leaflet, Lucide Icons, Recharts, Custom Responsive CSS Design System.
- **Backend**: Node.js, Express 5, RESTful API, Server-Sent Events (SSE).
- **Database & ORM**: PostgreSQL 16, Prisma ORM (Schema migrations, relations, idempotent seeders).
- **Containerization**: Docker Compose for PostgreSQL.

---

## 🚀 Quick Start Guide (Run Locally)

Follow these steps to set up and run RailSetu on your local machine:

### 1. Prerequisites

Ensure you have the following installed:
- **Node.js** (v18.x or v20.x recommended) & **npm**
- **Git**
- **Docker & Docker Compose** (or a local PostgreSQL 16 instance)

---

### 2. Clone the Repository

```bash
git clone https://github.com/Adi-tya-dev/RAIL_SETU_SIH.git
cd RAIL_SETU_SIH
```

---

### 3. Start PostgreSQL Database

If you have Docker installed, start the database with a single command:

```bash
docker compose up -d
```

*(This starts a PostgreSQL 16 container named `railsetu-postgres` on port `5432` with user `postgres` and password `postgres`)*

> **Note for Local PostgreSQL users:** If running PostgreSQL directly without Docker, create a database named `railway_block_planning` and note your username and password.

---

### 4. Backend Setup

1. Open a terminal and navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```

2. Create your `.env` configuration from the template:
   ```bash
   # Windows (PowerShell):
   Copy-Item .env.example .env

   # Linux / macOS / Git Bash:
   cp .env.example .env
   ```

   *(The default `.env.example` already has `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/railway_block_planning?schema=public"`, matching Docker Compose defaults)*

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run Prisma database migrations to create the schema:
   ```bash
   npx prisma migrate deploy
   ```

5. Seed the database with railway network and maintenance records:
   ```bash
   npm run db:seed
   ```

   *(Optional: Load extended corridor data and long-distance trains)*
   ```bash
   npm run seed:longdistance
   ```

6. Start the backend development server:
   ```bash
   npm run dev
   ```

   Backend API will run at: **`http://localhost:5000`**  
   Health check endpoint: **`http://localhost:5000/api/health`**

---

### 5. Frontend Setup

1. Open a **new terminal** and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   👉 **`http://localhost:5173`**

---

## 📁 Repository Structure

```
RAIL_SETU_SIH/
├── docker-compose.yml         # PostgreSQL 16 container configuration
├── WORK-REPORT.md             # Detailed architecture and milestone report
├── README.md                  # Setup & usage instructions
│
├── Backend/                   # Express REST API & Scheduling Engine
│   ├── server.js              # Application entry point
│   ├── prisma/                # Prisma schema, migrations & seed scripts
│   │   ├── schema.prisma      # 19 relational models
│   │   ├── migrations/        # Version-controlled migrations
│   │   └── seed.js            # Baseline railway network seeder
│   └── src/
│       ├── algorithms/        # Optimization, rerouting & conflict engines
│       ├── controllers/       # API route controllers
│       ├── events/            # SSE and Pub/Sub event broadcaster
│       ├── integration/       # Adapters for TMS, SMMS, TDMS, COA
│       ├── routes/            # Express route definitions
│       └── services/          # Business logic & database operations
│
└── frontend/                  # React + Vite Control Room Application
    ├── src/
    │   ├── api/               # API clients and SSE stream connectors
    │   ├── components/        # UI components (Map, Drawers, Cards, Filters)
    │   ├── contexts/          # Live event and theme state providers
    │   ├── pages/             # Dashboard, Planning, Map, Maintenance, etc.
    │   └── utils/             # Formatters, constants, helpers
    └── vite.config.js         # Vite configuration
```

---

## 🧪 Testing

To run the backend test suite:

```bash
cd Backend
npm test
```

To validate the frontend build:

```bash
cd frontend
npm run build
```

---

## 📜 License

This project was developed for the **Smart India Hackathon (SIH)**.
