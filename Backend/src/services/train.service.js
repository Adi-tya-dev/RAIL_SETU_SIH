const prisma = require("../config/prisma");
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

async function findById(id) {
  const train_id = parsePositiveInt(id, "id");
  return prisma.train.findUnique({
    where: { train_id },
    include: detailInclude,
  });
}

module.exports = { findAll, findById };