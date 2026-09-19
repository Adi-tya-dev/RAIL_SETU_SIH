const prisma = require("../config/prisma");
const seedData = require("./seedData.provider");
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

  try {
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

    if (total > 0) {
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
  } catch (err) {
    // Database offline or error, fall back to seed data
  }

  // Fallback to seed data
  let filtered = [...seedData.blocks];
  if (status) {
    filtered = filtered.filter((b) => b.status.toUpperCase() === status);
  }
  if (availability !== undefined) {
    filtered = filtered.filter((b) => b.availability === availability);
  }
  if (section_id !== undefined) {
    filtered = filtered.filter((b) => b.track && b.track.section_id === section_id);
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
  const block_id = parsePositiveInt(id, "id");
  try {
    const block = await prisma.block.findUnique({
      where: { block_id },
      include: includeRelations,
    });
    if (block) return block;
  } catch (err) {
    // Database offline or error
  }

  return seedData.blockIdMap.get(block_id) || null;
}

module.exports = { findAll, findById };