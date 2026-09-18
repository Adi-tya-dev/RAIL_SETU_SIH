-- CreateTable
CREATE TABLE "zones" (
    "zone_id" BIGSERIAL NOT NULL,
    "zone_code" VARCHAR(20) NOT NULL,
    "zone_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("zone_id")
);

-- CreateTable
CREATE TABLE "divisions" (
    "division_id" BIGSERIAL NOT NULL,
    "zone_id" BIGINT NOT NULL,
    "division_code" VARCHAR(20) NOT NULL,
    "division_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("division_id")
);

-- CreateTable
CREATE TABLE "sections" (
    "section_id" BIGSERIAL NOT NULL,
    "division_id" BIGINT NOT NULL,
    "section_code" VARCHAR(20) NOT NULL,
    "section_name" VARCHAR(100) NOT NULL,
    "start_chainage" DECIMAL(12,2) NOT NULL,
    "end_chainage" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("section_id")
);

-- CreateTable
CREATE TABLE "stations" (
    "station_id" BIGSERIAL NOT NULL,
    "section_id" BIGINT NOT NULL,
    "station_code" VARCHAR(10) NOT NULL,
    "station_name" VARCHAR(100) NOT NULL,
    "latitude" DECIMAL(10,6),
    "longitude" DECIMAL(10,6),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("station_id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "track_id" BIGSERIAL NOT NULL,
    "section_id" BIGINT NOT NULL,
    "track_code" VARCHAR(20) NOT NULL,
    "track_name" VARCHAR(100) NOT NULL,
    "track_type" VARCHAR(50) NOT NULL,
    "gauge" VARCHAR(20),
    "status" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("track_id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "block_id" BIGSERIAL NOT NULL,
    "track_id" BIGINT NOT NULL,
    "block_code" VARCHAR(20) NOT NULL,
    "start_chainage" DECIMAL(12,2) NOT NULL,
    "end_chainage" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("block_id")
);

-- CreateTable
CREATE TABLE "trains" (
    "train_id" BIGSERIAL NOT NULL,
    "train_number" VARCHAR(20) NOT NULL,
    "train_name" VARCHAR(100) NOT NULL,
    "train_type" VARCHAR(30) NOT NULL,
    "origin_station_id" BIGINT,
    "destination_station_id" BIGINT,
    "priority" INTEGER,
    "status" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trains_pkey" PRIMARY KEY ("train_id")
);

-- CreateTable
CREATE TABLE "train_routes" (
    "train_route_id" BIGSERIAL NOT NULL,
    "train_id" BIGINT NOT NULL,
    "station_id" BIGINT,
    "sequence_number" INTEGER NOT NULL,
    "scheduled_arrival" TIMESTAMPTZ(3),
    "scheduled_departure" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "train_routes_pkey" PRIMARY KEY ("train_route_id")
);

-- CreateTable
CREATE TABLE "train_block_movements" (
    "movement_id" BIGSERIAL NOT NULL,
    "train_id" BIGINT NOT NULL,
    "block_id" BIGINT NOT NULL,
    "scheduled_entry" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_exit" TIMESTAMPTZ(3) NOT NULL,
    "actual_entry" TIMESTAMPTZ(3),
    "actual_exit" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "train_block_movements_pkey" PRIMARY KEY ("movement_id")
);

-- CreateTable
CREATE TABLE "assets" (
    "asset_id" BIGSERIAL NOT NULL,
    "asset_code" VARCHAR(30) NOT NULL,
    "asset_name" VARCHAR(100) NOT NULL,
    "asset_type" VARCHAR(50) NOT NULL,
    "block_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "criticality" INTEGER,
    "latitude" DECIMAL(10,6),
    "longitude" DECIMAL(10,6),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("asset_id")
);

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "maintenance_task_id" BIGSERIAL NOT NULL,
    "asset_id" BIGINT NOT NULL,
    "block_id" BIGINT,
    "section_id" BIGINT,
    "department" VARCHAR(50) NOT NULL,
    "maintenance_type" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "criticality" INTEGER NOT NULL DEFAULT 1,
    "urgency" INTEGER NOT NULL DEFAULT 1,
    "duration_minutes" INTEGER NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferred_start" TIMESTAMPTZ(3),
    "deadline" TIMESTAMPTZ(3),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("maintenance_task_id")
);

-- CreateTable
CREATE TABLE "block_plans" (
    "plan_id" BIGSERIAL NOT NULL,
    "block_id" BIGINT NOT NULL,
    "planned_start" TIMESTAMPTZ(3) NOT NULL,
    "planned_end" TIMESTAMPTZ(3) NOT NULL,
    "optimization_score" DECIMAL(10,4),
    "affected_train_count" INTEGER NOT NULL DEFAULT 0,
    "expected_delay_minutes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "asset_availability_score" DECIMAL(10,4),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PROPOSED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_plans_pkey" PRIMARY KEY ("plan_id")
);

-- CreateTable
CREATE TABLE "plan_maintenance_tasks" (
    "plan_maintenance_task_id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "maintenance_task_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_maintenance_tasks_pkey" PRIMARY KEY ("plan_maintenance_task_id")
);

-- CreateTable
CREATE TABLE "plan_train_impacts" (
    "impact_id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "train_id" BIGINT NOT NULL,
    "estimated_delay_minutes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "impact_type" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_train_impacts_pkey" PRIMARY KEY ("impact_id")
);

-- CreateTable
CREATE TABLE "block_conflicts" (
    "conflict_id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "train_id" BIGINT,
    "conflict_type" VARCHAR(100) NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_conflicts_pkey" PRIMARY KEY ("conflict_id")
);

-- CreateTable
CREATE TABLE "block_operations" (
    "operation_id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "actual_start" TIMESTAMPTZ(3),
    "actual_end" TIMESTAMPTZ(3),
    "completion_status" VARCHAR(50),
    "actual_affected_trains" INTEGER,
    "actual_delay_minutes" DECIMAL(10,2),
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_operations_pkey" PRIMARY KEY ("operation_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zones_zone_code_key" ON "zones"("zone_code");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_division_code_key" ON "divisions"("division_code");

-- CreateIndex
CREATE UNIQUE INDEX "sections_section_code_key" ON "sections"("section_code");

-- CreateIndex
CREATE UNIQUE INDEX "stations_station_code_key" ON "stations"("station_code");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_track_code_key" ON "tracks"("track_code");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_block_code_key" ON "blocks"("block_code");

-- CreateIndex
CREATE INDEX "blocks_status_idx" ON "blocks"("status");

-- CreateIndex
CREATE INDEX "blocks_availability_idx" ON "blocks"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "trains_train_number_key" ON "trains"("train_number");

-- CreateIndex
CREATE INDEX "train_routes_train_id_idx" ON "train_routes"("train_id");

-- CreateIndex
CREATE INDEX "train_block_movements_train_id_idx" ON "train_block_movements"("train_id");

-- CreateIndex
CREATE INDEX "train_block_movements_block_id_idx" ON "train_block_movements"("block_id");

-- CreateIndex
CREATE INDEX "train_block_movements_scheduled_entry_idx" ON "train_block_movements"("scheduled_entry");

-- CreateIndex
CREATE INDEX "train_block_movements_scheduled_exit_idx" ON "train_block_movements"("scheduled_exit");

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_code_key" ON "assets"("asset_code");

-- CreateIndex
CREATE INDEX "assets_asset_type_idx" ON "assets"("asset_type");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "maintenance_tasks_status_idx" ON "maintenance_tasks"("status");

-- CreateIndex
CREATE INDEX "maintenance_tasks_department_idx" ON "maintenance_tasks"("department");

-- CreateIndex
CREATE INDEX "maintenance_tasks_block_id_idx" ON "maintenance_tasks"("block_id");

-- CreateIndex
CREATE INDEX "maintenance_tasks_section_id_idx" ON "maintenance_tasks"("section_id");

-- CreateIndex
CREATE INDEX "maintenance_tasks_deadline_idx" ON "maintenance_tasks"("deadline");

-- CreateIndex
CREATE INDEX "maintenance_tasks_priority_idx" ON "maintenance_tasks"("priority");

-- CreateIndex
CREATE INDEX "maintenance_tasks_criticality_idx" ON "maintenance_tasks"("criticality");

-- CreateIndex
CREATE INDEX "maintenance_tasks_urgency_idx" ON "maintenance_tasks"("urgency");

-- CreateIndex
CREATE INDEX "block_plans_planned_start_idx" ON "block_plans"("planned_start");

-- CreateIndex
CREATE INDEX "block_plans_planned_end_idx" ON "block_plans"("planned_end");

-- CreateIndex
CREATE INDEX "block_plans_status_idx" ON "block_plans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plan_maintenance_tasks_plan_id_maintenance_task_id_key" ON "plan_maintenance_tasks"("plan_id", "maintenance_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_train_impacts_plan_id_train_id_key" ON "plan_train_impacts"("plan_id", "train_id");

-- CreateIndex
CREATE INDEX "block_conflicts_train_id_idx" ON "block_conflicts"("train_id");

-- CreateIndex
CREATE INDEX "block_conflicts_resolved_idx" ON "block_conflicts"("resolved");

-- CreateIndex
CREATE INDEX "block_conflicts_severity_idx" ON "block_conflicts"("severity");

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("zone_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("division_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("track_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trains" ADD CONSTRAINT "trains_origin_station_id_fkey" FOREIGN KEY ("origin_station_id") REFERENCES "stations"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trains" ADD CONSTRAINT "trains_destination_station_id_fkey" FOREIGN KEY ("destination_station_id") REFERENCES "stations"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "train_routes" ADD CONSTRAINT "train_routes_train_id_fkey" FOREIGN KEY ("train_id") REFERENCES "trains"("train_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "train_routes" ADD CONSTRAINT "train_routes_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("station_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "train_block_movements" ADD CONSTRAINT "train_block_movements_train_id_fkey" FOREIGN KEY ("train_id") REFERENCES "trains"("train_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "train_block_movements" ADD CONSTRAINT "train_block_movements_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("block_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("block_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("block_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_plans" ADD CONSTRAINT "block_plans_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("block_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_maintenance_tasks" ADD CONSTRAINT "plan_maintenance_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "block_plans"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_maintenance_tasks" ADD CONSTRAINT "plan_maintenance_tasks_maintenance_task_id_fkey" FOREIGN KEY ("maintenance_task_id") REFERENCES "maintenance_tasks"("maintenance_task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_train_impacts" ADD CONSTRAINT "plan_train_impacts_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "block_plans"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_train_impacts" ADD CONSTRAINT "plan_train_impacts_train_id_fkey" FOREIGN KEY ("train_id") REFERENCES "trains"("train_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_conflicts" ADD CONSTRAINT "block_conflicts_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "block_plans"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_conflicts" ADD CONSTRAINT "block_conflicts_train_id_fkey" FOREIGN KEY ("train_id") REFERENCES "trains"("train_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_operations" ADD CONSTRAINT "block_operations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "block_plans"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;
