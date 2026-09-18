const prisma = require("../config/prisma");
const {
  optionalString,
  parsePagination,
  parseOptionalInt,
  parseRange,
} = require("../utils/validation.util");

const includeRelations = {
  block: true,
  section: true,
};

async function findAll(query) {
  const { page, limit, skip, take } = parsePagination(query);

  const where = {};
  const status = optionalString(query.status);
  if (status) where.status = status.toUpperCase();
  const criticality = parseRange(query.criticality, "criticality", 1, 4);
  if (criticality !== undefined) where.criticality = criticality;
  const block_id = parseOptionalInt(query.block_id, "block_id");
  if (block_id !== undefined) where.block_id = block_id;
  const section_id = parseOptionalInt(query.section_id, "section_id");
  if (section_id !== undefined) where.section_id = section_id;

  const [total, assets] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      skip,
      take,
      orderBy: { asset_id: "asc" },
      include: includeRelations,
    }),
  ]);

  return {
    data: assets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = { findAll };