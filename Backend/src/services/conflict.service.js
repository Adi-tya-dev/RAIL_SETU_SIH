const prisma = require("../config/prisma");
const { parsePagination, parseBoolean, optionalString, parsePositiveInt } = require("../utils/validation.util");

async function findAll(query = {}) {
  const { page, limit, skip, take } = parsePagination(query, { fallbackLimit: 100, maxLimit: 500 });
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

  const [total, conflicts] = await Promise.all([
    prisma.blockConflict.count({ where }),
    prisma.blockConflict.findMany({
      where,
      skip,
      take,
      orderBy: [{ severity: "desc" }, { created_at: "desc" }],
      include: {
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
      },
    }),
  ]);

  // Deduplicate conflicts to avoid repeated rows
  const seen = new Set();
  const formatted = [];
  for (const c of conflicts) {
    const maintTask = c.plan?.plan_maintenance_tasks?.[0]?.maintenance_task || null;
    const descKey = (c.description || "").trim().toLowerCase();
    const trainKey = String(c.train_id || c.train?.train_number || "");
    const blockKey = String(c.plan?.block?.block_code || "");
    const key = `${c.conflict_type}_${trainKey}_${blockKey}_${descKey}`;

    if (!seen.has(key)) {
      seen.add(key);
      formatted.push({
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
      });
    }
  }

  const totalCount = formatted.length;
  const paged = formatted.slice(skip, skip + take);

  return {
    data: paged,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

module.exports = { findAll };
