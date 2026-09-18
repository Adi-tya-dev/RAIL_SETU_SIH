const prisma = require("../config/prisma");
const {
  optionalString,
  parsePositiveInt,
  parsePagination,
  parseOptionalInt,
  parseBoolean,
} = require("../utils/validation.util");

const includeRelations = {
  track: { include: { section: true } },
};

async function findAll(query) {
  const { page, limit, skip, take } = parsePagination(query);

  const where = {};
  const status = optionalString(query.status);
  if (status) where.status = status.toUpperCase();
  const availability = parseBoolean(query.availability, "availability");
  if (availability !== undefined) where.availability = availability;
  const section_id = parseOptionalInt(query.section_id, "section_id");
  if (section_id !== undefined) where.track = { section_id };

  const [total, blocks] = await Promise.all([
    prisma.block.count({ where }),
    prisma.block.findMany({
      where,
      skip,
      take,
      orderBy: { block_id: "asc" },
      include: includeRelations,
    }),
  ]);

  return {
    data: blocks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function findById(id) {
  const block_id = parsePositiveInt(id, "id");
  return prisma.block.findUnique({
    where: { block_id },
    include: includeRelations,
  });
}

module.exports = { findAll, findById };