const prisma = require("../config/prisma");
const seedData = require("./seedData.provider");
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

  try {
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

    if (total > 0) {
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
  } catch (err) {
    // Database offline or error, fall back to seed data
  }

  // Fallback to seed data
  let filtered = [...seedData.assets];
  if (status) {
    filtered = filtered.filter((a) => a.status && a.status.toUpperCase() === status);
  }
  if (criticality !== undefined) {
    filtered = filtered.filter((a) => a.criticality === criticality);
  }
  if (block_id !== undefined) {
    filtered = filtered.filter((a) => a.block_id === block_id);
  }
  if (section_id !== undefined) {
    filtered = filtered.filter((a) => a.section_id === section_id);
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

module.exports = { findAll };