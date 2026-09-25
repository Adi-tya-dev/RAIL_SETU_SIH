const prisma = require("../config/prisma");
const { parsePagination, parseBoolean, optionalString, parsePositiveInt } = require("../utils/validation.util");

async function findAll(query = {}) {
  const { page, limit, skip, take } = parsePagination(query, { fallbackLimit: 100, maxLimit: 1000 });
  const where = {};

  const resolved = parseBoolean(query.resolved, "resolved");
  if (resolved !== undefined) where.resolved = resolved;

  const severity = query.severity !== undefined ? Number(query.severity) : undefined;
  if (severity && Number.isFinite(severity)) where.severity = severity;

  const conflictType = optionalString(query.conflict_type);
  if (conflictType) where.conflict_type = conflictType;

  const trainNumber = optionalString(query.trainNumber || query.train);
  const trainId = query.trainId || query.train_id;
  const blockCode = optionalString(query.block || query.block_code);

  if (trainNumber || trainId) {
    const orConditions = [];
    if (trainId) {
      try {
        orConditions.push({ train_id: BigInt(trainId) });
      } catch (e) {}
    }
    if (trainNumber) {
      const tNum = String(trainNumber).trim();
      orConditions.push({ train: { train_number: tNum } });
      orConditions.push({ description: { contains: tNum } });
    }
    if (orConditions.length > 0) {
      where.OR = orConditions;
    }
  }

  if (blockCode) {
    where.plan = {
      block: {
        block_code: String(blockCode).trim().toUpperCase(),
      },
    };
  }

  const includeClause = {
    train: {
      include: {
        origin_station: true,
        destination_station: true,
      },
    },
    plan: {
      include: {
        block: {
          include: {
            track: {
              include: {
                section: true,
              },
            },
          },
        },
        plan_maintenance_tasks: {
          include: {
            maintenance_task: true,
          },
        },
      },
    },
  };

  const total = await prisma.blockConflict.count({ where });

  let conflicts;
  if (!conflictType && !trainNumber && !trainId && !blockCode) {
    // If querying general conflicts, fetch representative non-movement conflicts first
    // so they are not entirely crowded out by 2400+ train movement collisions.
    const nonMovementLimit = Math.min(take, 200);
    const [nonMovement, movement] = await Promise.all([
      prisma.blockConflict.findMany({
        where: { ...where, conflict_type: { not: "TRAIN_TRAIN_MOVEMENT" } },
        orderBy: [{ severity: "desc" }, { created_at: "desc" }],
        take: nonMovementLimit,
        include: includeClause,
      }),
      prisma.blockConflict.findMany({
        where: { ...where, conflict_type: "TRAIN_TRAIN_MOVEMENT" },
        skip,
        take: Math.max(take - nonMovementLimit, 50),
        orderBy: [{ severity: "desc" }, { created_at: "desc" }],
        include: includeClause,
      }),
    ]);
    conflicts = [...nonMovement, ...movement].sort((a, b) => (b.severity || 0) - (a.severity || 0));
  } else {
    conflicts = await prisma.blockConflict.findMany({
      where,
      skip,
      take,
      orderBy: [{ severity: "desc" }, { created_at: "desc" }],
      include: includeClause,
    });
  }

  const formatted = conflicts.map((c) => {
    const maintTask = c.plan?.plan_maintenance_tasks?.[0]?.maintenance_task || null;
    return {
      conflict_id: String(c.conflict_id),
      plan_id: String(c.plan_id),
      train_id: c.train_id ? String(c.train_id) : null,
      conflict_type: c.conflict_type,
      severity: c.severity,
      description: c.description,
      resolved: c.resolved,
      created_at: c.created_at,
      train: c.train,
      plan: c.plan,
      block: c.plan?.block || null,
      maintenance_task: maintTask,
    };
  });

  return {
    data: formatted,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = { findAll };
