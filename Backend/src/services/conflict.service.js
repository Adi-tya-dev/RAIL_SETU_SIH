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
          },
        },
      },
    }),
  ]);

  const formatted = conflicts.map((c) => ({
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
  }));

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
