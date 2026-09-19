-- AlterTable
ALTER TABLE "block_plans" ADD COLUMN     "adjustment_reason" TEXT,
ADD COLUMN     "original_window" TEXT,
ADD COLUMN     "parent_plan_id" BIGINT,
ADD COLUMN     "plan_horizon" VARCHAR(20) NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN     "resource_requirements" JSONB,
ADD COLUMN     "work_package_code" VARCHAR(50);

-- CreateIndex
CREATE INDEX "block_plans_plan_horizon_idx" ON "block_plans"("plan_horizon");

-- CreateIndex
CREATE INDEX "block_plans_parent_plan_id_idx" ON "block_plans"("parent_plan_id");

-- AddForeignKey
ALTER TABLE "block_plans" ADD CONSTRAINT "block_plans_parent_plan_id_fkey" FOREIGN KEY ("parent_plan_id") REFERENCES "block_plans"("plan_id") ON DELETE SET NULL ON UPDATE CASCADE;
