const prisma = require("../config/prisma");
const seedData = require("./seedData.provider");
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

  try {
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

    if (total > 0) {
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
  } catch (err) {
    // Database offline or error, fall back to seed data
  }

  // Fallback to seed data
  let filtered = [...seedData.maintenanceTasks];
  if (department) {
    filtered = filtered.filter((t) => t.department && t.department.toUpperCase() === department);
  }
  if (status) {
    filtered = filtered.filter((t) => t.status && t.status.toUpperCase() === status);
  }
  if (priority !== undefined) {
    filtered = filtered.filter((t) => t.priority === priority);
  }
  if (block_id !== undefined) {
    filtered = filtered.filter((t) => t.block_id === block_id);
  }
  if (section_id !== undefined) {
    filtered = filtered.filter((t) => t.section_id === section_id);
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
  const maintenance_task_id = parsePositiveInt(id, "id");
  try {
    const task = await prisma.maintenanceTask.findUnique({
      where: { maintenance_task_id },
      include: listInclude,
    });
    if (task) return task;
  } catch (err) {
    // Database offline or error
  }

  return seedData.taskIdMap.get(maintenance_task_id) || null;
}

module.exports = { findAll, findById };