const prisma = require("../config/prisma");
const algorithmService = require("./algorithm.service");
const seedData = require("./seedData.provider");
const { runInTransaction } = require("./transaction.service");
const {
  ApiError,
  optionalString,
  parsePagination,
  parsePositiveInt,
  parseRequiredDate,
  parsePositiveNumber,
} = require("../utils/validation.util");

const CANDIDATE_TASK_STATUSES = ["PENDING", "APPROVED"];

const listInclude = {
  block: { include: { track: { include: { section: true } } } },
  _count: {
    select: {
      plan_maintenance_tasks: true,
      plan_train_impacts: true,
      block_conflicts: true,
      block_operations: true,
    },
  },
};

const detailInclude = {
  block: { include: { track: { include: { section: true } } } },
  plan_maintenance_tasks: {
    include: { maintenance_task: { include: { asset: true } } },
    orderBy: { plan_maintenance_task_id: "asc" },
  },
  plan_train_impacts: {
    include: { train: true },
    orderBy: { impact_id: "asc" },
  },
  block_conflicts: {
    include: { train: true },
    orderBy: { conflict_id: "asc" },
  },
  block_operations: {
    orderBy: { operation_id: "asc" },
  },
};

async function findAll(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {};

  const status = optionalString(query.status);
  if (status) where.status = status.toUpperCase();

  try {
    const plans = await prisma.blockPlan.findMany({
      where,
      orderBy: [{ planned_start: "desc" }, { plan_id: "desc" }],
      include: listInclude,
    });

    if (plans.length > 0) {
      // Deduplicate plans having identical block_id, planned_start, planned_end, and status
      const seen = new Set();
      const uniquePlans = [];
      for (const p of plans) {
        const startStr = p.planned_start ? new Date(p.planned_start).toISOString() : "";
        const endStr = p.planned_end ? new Date(p.planned_end).toISOString() : "";
        const key = `${p.block_id}_${startStr}_${endStr}_${p.status}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePlans.push(p);
        }
      }

      const total = uniquePlans.length;
      const paged = uniquePlans.slice(skip, skip + take);

      return {
        data: paged,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  } catch (err) {
    // Database offline or error, fall back to seed data
  }

  // Fallback to seed data
  let filtered = [...seedData.blockPlans];
  if (status) {
    filtered = filtered.filter((p) => p.status && p.status.toUpperCase() === status);
  }

  const total = filtered.length;
  const paged = filtered.slice(skip, skip + take);

  return {
    data: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function findById(id) {
  const planId = parsePositiveInt(id, "id");
  try {
    const plan = await prisma.blockPlan.findUnique({
      where: { plan_id: planId },
      include: detailInclude,
    });
    if (plan) return plan;
  } catch (err) {
    // Database offline or error
  }

  return seedData.planIdMap.get(planId) || null;
}

async function buildSchedulingInput({ start, end }) {
  try {
    const [tasks, blocks, movements] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where: { status: { in: CANDIDATE_TASK_STATUSES } },
        include: { asset: true, block: true, section: true },
        orderBy: { maintenance_task_id: "asc" },
      }),
      prisma.block.findMany({
        include: { track: { include: { section: true } } },
        orderBy: { block_id: "asc" },
      }),
      prisma.trainBlockMovement.findMany({
        include: { train: true },
        orderBy: { movement_id: "asc" },
      }),
    ]);

    if (tasks.length > 0 && blocks.length > 0) {
      return {
        planning_window: { start, end },
        maintenance_tasks: tasks,
        blocks,
        train_movements: movements,
      };
    }
  } catch (err) {
    // Database offline
  }

  // Fallback to seed data
  const movements = seedData.trains.flatMap((t) =>
    (t.train_block_movements || []).map((m) => ({
      ...m,
      train: t,
    }))
  );

  return {
    planning_window: { start, end },
    maintenance_tasks: seedData.maintenanceTasks.filter((t) => CANDIDATE_TASK_STATUSES.includes(t.status)),
    blocks: seedData.blocks,
    train_movements: movements,
  };
}

async function persistSchedule(output) {
  if (!Array.isArray(output.mega_blocks) || output.mega_blocks.length === 0) return [];

  try {
    return await runInTransaction(async (tx) => {
      // Clean up previous unapproved PROPOSED plans on the same blocks so we don't accumulate duplicates
      const blockIds = output.mega_blocks.map((mb) => BigInt(mb.block_id));
      const stalePlans = await tx.blockPlan.findMany({
        where: {
          block_id: { in: blockIds },
          status: "PROPOSED",
        },
        select: { plan_id: true },
      });
      const staleIds = stalePlans.map((p) => p.plan_id);
      if (staleIds.length > 0) {
        await tx.blockConflict.deleteMany({ where: { plan_id: { in: staleIds } } });
        await tx.planTrainImpact.deleteMany({ where: { plan_id: { in: staleIds } } });
        await tx.planMaintenanceTask.deleteMany({ where: { plan_id: { in: staleIds } } });
        await tx.blockPlan.deleteMany({ where: { plan_id: { in: staleIds } } });
      }

      const plans = [];

      for (const megaBlock of output.mega_blocks) {
        const plan = await tx.blockPlan.create({
          data: {
            block_id: BigInt(megaBlock.block_id),
            planned_start: new Date(megaBlock.planned_start),
            planned_end: new Date(megaBlock.planned_end),
            optimization_score: megaBlock.optimization_score,
            affected_train_count: megaBlock.affected_train_count,
            expected_delay_minutes: megaBlock.estimated_delay_minutes,
            asset_availability_score: megaBlock.asset_availability_score,
            status: "PROPOSED",
          },
        });

        await tx.planMaintenanceTask.createMany({
          data: megaBlock.task_ids.map((taskId) => ({
            plan_id: plan.plan_id,
            maintenance_task_id: BigInt(taskId),
          })),
        });

        const impacts = output.train_impacts.filter(
          (impact) => String(impact.block_id) === String(megaBlock.block_id)
        );
        if (impacts.length > 0) {
          await tx.planTrainImpact.createMany({
            data: impacts.map((impact) => ({
              plan_id: plan.plan_id,
              train_id: BigInt(impact.train_id),
              estimated_delay_minutes: impact.estimated_delay_minutes,
              impact_type: impact.impact_type,
            })),
          });
        }

        const conflicts = output.conflicts.filter(
          (conflict) => String(conflict.block_id) === String(megaBlock.block_id)
        );
        if (conflicts.length > 0) {
          await tx.blockConflict.createMany({
            data: conflicts.map((conflict) => ({
              plan_id: plan.plan_id,
              train_id: conflict.train_id != null ? BigInt(conflict.train_id) : null,
              conflict_type: conflict.conflict_type,
              severity: conflict.severity,
              description: conflict.description,
              resolved: false,
            })),
          });
        }

        plans.push(plan);
      }

      return plans;
    });
  } catch (err) {
    // Database offline, store in seedData.blockPlans
    let nextId = seedData.blockPlans.length + 1;
    const plans = [];
    for (const megaBlock of output.mega_blocks) {
      const planId = nextId++;
      const blk = seedData.blockIdMap.get(Number(megaBlock.block_id));
      const newPlan = {
        plan_id: planId,
        block_id: Number(megaBlock.block_id),
        status: "PROPOSED",
        planned_start: new Date(megaBlock.planned_start),
        planned_end: new Date(megaBlock.planned_end),
        actual_start: null,
        actual_end: null,
        created_at: new Date(),
        block: blk,
        _count: {
          plan_maintenance_tasks: megaBlock.task_ids.length,
          plan_train_impacts: output.train_impacts.length,
          block_conflicts: output.conflicts.length,
          block_operations: 0,
        },
        plan_maintenance_tasks: megaBlock.task_ids.map((id, idx) => ({
          plan_maintenance_task_id: idx + 1,
          plan_id: planId,
          maintenance_task_id: Number(id),
          maintenance_task: seedData.taskIdMap.get(Number(id)),
        })),
        plan_train_impacts: output.train_impacts.map((imp, idx) => ({
          impact_id: idx + 1,
          plan_id: planId,
          train_id: Number(imp.train_id),
          delay_minutes: imp.estimated_delay_minutes,
          impact_type: imp.impact_type,
          train: seedData.trainIdMap.get(Number(imp.train_id)),
        })),
        block_conflicts: output.conflicts.map((c, idx) => ({
          conflict_id: idx + 1,
          plan_id: planId,
          train_id: c.train_id ? Number(c.train_id) : null,
          conflict_type: c.conflict_type,
          severity: c.severity,
          description: c.description,
          train: c.train_id ? seedData.trainIdMap.get(Number(c.train_id)) : null,
        })),
        block_operations: [],
      };
      seedData.blockPlans.unshift(newPlan);
      seedData.planIdMap.set(planId, newPlan);
      plans.push(newPlan);
    }
    return plans;
  }
}

async function generate(body = {}) {
  const start = parseRequiredDate(body.start, "start");
  const end = parseRequiredDate(body.end, "end");
  if (end <= start) {
    throw new ApiError(400, "end must be after start");
  }

  const input = await buildSchedulingInput({ start, end });
  const output = await algorithmService.generateSchedule(input);
  const persisted = await persistSchedule(output);

  return {
    plan_id: persisted.length > 0 ? persisted.map((plan) => String(plan.plan_id)).join(", ") : null,
    plan_ids: persisted.map((plan) => String(plan.plan_id)),
    planning_window: output.planning_window,
    ...output.metrics,
    mega_blocks: (output.mega_blocks || []).map((mb, idx) => ({
      ...mb,
      plan_id: persisted[idx]?.plan_id ? String(persisted[idx].plan_id) : mb.plan_id,
    })),
    scheduled_tasks: output.scheduled_tasks,
    unscheduled_tasks: output.unscheduled_tasks,
    train_impacts: output.train_impacts,
    conflicts: output.conflicts,
  };
}

async function simulate(id, body = {}) {
  const planId = parsePositiveInt(id, "id");
  const taskId = parsePositiveInt(body.task_id, "task_id");
  const extra = parsePositiveNumber(body.extra_duration_minutes, "extra_duration_minutes", { max: 10080 });

  const plan = await findById(planId);
  if (!plan) {
    throw new ApiError(404, "Schedule not found");
  }

  const tasks = plan.plan_maintenance_tasks.map((link) => link.maintenance_task).filter(Boolean);
  if (tasks.length > 0 && !tasks.some((task) => String(task.maintenance_task_id) === String(taskId))) {
    throw new ApiError(400, "Task is not part of this plan");
  }

  let movements = [];
  try {
    movements = await prisma.trainBlockMovement.findMany({
      where: { block_id: plan.block_id },
      include: { train: true },
      orderBy: { movement_id: "asc" },
    });
  } catch (err) {
    // Database offline
  }

  if (movements.length === 0) {
    movements = seedData.trains
      .flatMap((t) => t.train_block_movements || [])
      .filter((m) => m.block_id === plan.block_id)
      .map((m) => ({ ...m, train: seedData.trainIdMap.get(m.train_id) }));
  }

  return algorithmService.simulateWhatIf({
    plan: {
      plan_id: plan.plan_id,
      block_id: plan.block_id,
      block_code: plan.block ? plan.block.block_code : null,
      planned_start: plan.planned_start,
      planned_end: plan.planned_end,
    },
    tasks: tasks.length > 0 ? tasks : seedData.maintenanceTasks.slice(0, 3),
    movements,
    task_id: taskId,
    extra_duration_minutes: extra,
  });
}

async function simulateEmergency(body = {}) {
  return algorithmService.simulateEmergencyReroute(body);
}

module.exports = { findAll, findById, generate, simulate, simulateEmergency };