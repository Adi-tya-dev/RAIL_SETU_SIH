-- AlterTable
ALTER TABLE "maintenance_tasks" ADD COLUMN     "external_ref" VARCHAR(64),
ADD COLUMN     "source" VARCHAR(20);

-- CreateTable
CREATE TABLE "source_sync_runs" (
    "sync_run_id" BIGSERIAL NOT NULL,
    "triggered_by" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "status" VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "summary" JSONB,
    "errors" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_sync_runs_pkey" PRIMARY KEY ("sync_run_id")
);

-- CreateTable
CREATE TABLE "source_records" (
    "source_record_id" BIGSERIAL NOT NULL,
    "sync_run_id" BIGINT,
    "source" VARCHAR(20) NOT NULL,
    "record_type" VARCHAR(50) NOT NULL,
    "source_ref" VARCHAR(64) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'IMPORTED',
    "maintenance_task_id" BIGINT,
    "block_id" BIGINT,
    "asset_id" BIGINT,
    "train_id" BIGINT,
    "payload" JSONB,
    "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_records_pkey" PRIMARY KEY ("source_record_id")
);

-- CreateTable
CREATE TABLE "goods_train_forecasts" (
    "goods_forecast_id" BIGSERIAL NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'COA',
    "external_ref" VARCHAR(64) NOT NULL,
    "forecast_date" DATE NOT NULL,
    "section_id" BIGINT,
    "train_number" VARCHAR(20),
    "service" VARCHAR(50),
    "direction" VARCHAR(10),
    "origin_station_code" VARCHAR(10),
    "destination_station_code" VARCHAR(10),
    "planned_tonnes" INTEGER,
    "rake_count" INTEGER,
    "start_window" TIMESTAMPTZ(3),
    "end_window" TIMESTAMPTZ(3),
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goods_train_forecasts_pkey" PRIMARY KEY ("goods_forecast_id")
);

-- CreateIndex
CREATE INDEX "source_sync_runs_status_idx" ON "source_sync_runs"("status");

-- CreateIndex
CREATE INDEX "source_sync_runs_started_at_idx" ON "source_sync_runs"("started_at");

-- CreateIndex
CREATE INDEX "source_records_source_idx" ON "source_records"("source");

-- CreateIndex
CREATE INDEX "source_records_record_type_idx" ON "source_records"("record_type");

-- CreateIndex
CREATE INDEX "source_records_source_ref_idx" ON "source_records"("source_ref");

-- CreateIndex
CREATE INDEX "source_records_maintenance_task_id_idx" ON "source_records"("maintenance_task_id");

-- CreateIndex
CREATE INDEX "source_records_imported_at_idx" ON "source_records"("imported_at");

-- CreateIndex
CREATE UNIQUE INDEX "goods_train_forecasts_external_ref_key" ON "goods_train_forecasts"("external_ref");

-- CreateIndex
CREATE INDEX "goods_train_forecasts_forecast_date_idx" ON "goods_train_forecasts"("forecast_date");

-- CreateIndex
CREATE INDEX "goods_train_forecasts_section_id_idx" ON "goods_train_forecasts"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_tasks_source_external_ref_key" ON "maintenance_tasks"("source", "external_ref");

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "source_sync_runs"("sync_run_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_maintenance_task_id_fkey" FOREIGN KEY ("maintenance_task_id") REFERENCES "maintenance_tasks"("maintenance_task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("block_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_train_id_fkey" FOREIGN KEY ("train_id") REFERENCES "trains"("train_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_train_forecasts" ADD CONSTRAINT "goods_train_forecasts_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE SET NULL ON UPDATE CASCADE;