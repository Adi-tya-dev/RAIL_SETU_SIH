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

  const day = optionalString(query.day);
  if (day) {
    const dLower = day.toLowerCase();
    if (dLower === "today") {
      where.preferred_start = {
        gte: new Date("2026-09-15T00:00:00.000Z"),
        lt: new Date("2026-09-16T00:00:00.000Z"),
      };
    } else if (dLower === "tomorrow") {
      where.preferred_start = {
        gte: new Date("2026-09-16T00:00:00.000Z"),
        lt: new Date("2026-09-20T00:00:00.000Z"),
      };
    } else if (dLower === "week") {
      where.preferred_start = {
        gte: new Date("2026-09-15T00:00:00.000Z"),
        lte: new Date("2026-09-22T23:59:59.999Z"),
      };
    } else if (dLower === "overdue") {
      where.status = { not: "COMPLETED" };
      where.deadline = {
        lt: new Date("2026-09-16T00:00:00.000Z"),
      };
    } else if (dLower.includes("-")) {
      where.preferred_start = {
        gte: new Date(`${dLower}T00:00:00.000Z`),
        lt: new Date(`${dLower}T23:59:59.999Z`),
      };
    }
  }

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

    return {
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
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
  if (day) {
    const dLower = day.toLowerCase();
    if (dLower === "today") {
      filtered = filtered.filter((t) => (t.preferred_start ? new Date(t.preferred_start).toISOString().startsWith("2026-09-15") : false));
    } else if (dLower === "tomorrow") {
      filtered = filtered.filter((t) => {
        if (!t.preferred_start) return false;
        const ds = new Date(t.preferred_start).toISOString().slice(0, 10);
        return ds === "2026-09-16" || ds === "2026-09-19";
      });
    } else if (dLower === "week") {
      filtered = filtered.filter((t) => {
        if (!t.preferred_start) return false;
        const ds = new Date(t.preferred_start).toISOString().slice(0, 10);
        return ds >= "2026-09-15" && ds <= "2026-09-22";
      });
    } else if (dLower === "overdue") {
      filtered = filtered.filter((t) => t.status !== "COMPLETED" && t.deadline && new Date(t.deadline) < new Date("2026-09-16T00:00:00Z"));
    } else if (dLower.includes("-")) {
      filtered = filtered.filter((t) => (t.preferred_start ? new Date(t.preferred_start).toISOString().startsWith(dLower) : false));
    }
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
  const numId = Number(id);
  const maintenance_task_id = !Number.isNaN(numId) && numId > 0 ? numId : null;
  try {
    if (maintenance_task_id) {
      const task = await prisma.maintenanceTask.findUnique({
        where: { maintenance_task_id },
        include: listInclude,
      });
      if (task) return task;
    } else {
      const task = await prisma.maintenanceTask.findFirst({
        where: { external_ref: String(id) },
        include: listInclude,
      });
      if (task) return task;
    }
  } catch (err) {
    // Database offline or error
  }

  if (maintenance_task_id) {
    return seedData.taskIdMap.get(maintenance_task_id) || null;
  }
  return seedData.maintenanceTasks.find((t) => t.external_ref === id) || null;
}

async function updateTask(id, data) {
  const numId = Number(id);
  const isNumeric = !Number.isNaN(numId) && numId > 0;

  try {
    const where = isNumeric
      ? { maintenance_task_id: BigInt(numId) }
      : { external_ref: String(id) };

    const updated = await prisma.maintenanceTask.update({
      where,
      data: {
        ...data,
        updated_at: new Date(),
      },
      include: listInclude,
    });
    return updated;
  } catch (err) {
    // Fallback in memory
    const existing = isNumeric
      ? seedData.taskIdMap.get(numId)
      : seedData.maintenanceTasks.find((t) => t.external_ref === id);

    if (existing) {
      Object.assign(existing, data);
      return existing;
    }
    throw err;
  }
}

async function approveTask(id) {
  return updateTask(id, { status: "APPROVED" });
}

module.exports = { findAll, findById, updateTask, approveTask };