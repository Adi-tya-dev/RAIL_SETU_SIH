const prisma = require("../config/prisma");
const seedData = require("./seedData.provider");
const {
  optionalString,
  parsePositiveInt,
  parsePagination,
  parseRange,
} = require("../utils/validation.util");

const listInclude = {
  origin_station: true,
  destination_station: true,
};

const detailInclude = {
  origin_station: true,
  destination_station: true,
  train_routes: {
    include: { station: true },
    orderBy: { sequence_number: "asc" },
  },
  train_block_movements: {
    include: { block: true },
    orderBy: { scheduled_entry: "asc" },
  },
};

async function findAll(query) {
  const { page, limit, skip, take } = parsePagination(query);

  const where = {};
  const status = optionalString(query.status);
  if (status) where.status = status.toUpperCase();
  const priority = parseRange(query.priority, "priority", 1, 4);
  if (priority !== undefined) where.priority = priority;

  try {
    const [total, trains] = await Promise.all([
      prisma.train.count({ where }),
      prisma.train.findMany({
        where,
        skip,
        take,
        orderBy: { train_id: "asc" },
        include: listInclude,
      }),
    ]);

    if (total > 0) {
      return {
        data: trains,
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
  let filtered = [...seedData.trains];
  if (status) {
    filtered = filtered.filter((t) => t.status.toUpperCase() === status);
  }
  if (priority !== undefined) {
    filtered = filtered.filter((t) => t.priority === priority);
  }
  if (query.search) {
    const s = String(query.search).toLowerCase();
    filtered = filtered.filter(
      (t) => t.train_number.toLowerCase().includes(s) || t.train_name.toLowerCase().includes(s)
    );
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
  const train_id = parsePositiveInt(id, "id");
  try {
    const train = await prisma.train.findUnique({
      where: { train_id },
      include: detailInclude,
    });
    if (train) return train;
  } catch (err) {
    // Database offline or error
  }

  return seedData.trainIdMap.get(train_id) || null;
}

module.exports = { findAll, findById };