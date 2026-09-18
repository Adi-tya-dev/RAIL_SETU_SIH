const prisma = require("../config/prisma");
const {
  optionalString,
  parsePositiveInt,
  parsePagination,
  parseOptionalInt,
  parseRange,
} = require("../utils/validation.util");

const listInclude = {
  asset: true,
  block: true,
  section: true,
};

async function findAll(query) {
  const { page, limit, skip, take } = parsePagination(query);

  const where = {};
  const department = optionalString(query.department);
  if (department) where.department = department.toUpperCase();
  const status = optionalString(query.status);
  if (status) where.status = status.toUpperCase();
  const priority = parseRange(query.priority, "priority", 1, 4);
  if (priority !== undefined) where.priority = priority;
  const block_id = parseOptionalInt(query.block_id, "block_id");
  if (block_id !== undefined) where.block_id = block_id;
  const section_id = parseOptionalInt(query.section_id, "section_id");
  if (section_id !== undefined) where.section_id = section_id;

  const [total, tasks] = await Promise.all([
    prisma.maintenanceTask.count({ where }),
    prisma.maintenanceTask.findMany({
      where,
      skip,
      take,
      orderBy: { maintenance_task_id: "asc" },
      include: listInclude,
    }),
  ]);

  return {
    data: tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function findById(id) {
  const maintenance_task_id = parsePositiveInt(id, "id");
  return prisma.maintenanceTask.findUnique({
    where: { maintenance_task_id },
    include: listInclude,
  });
}

module.exports = { findAll, findById };