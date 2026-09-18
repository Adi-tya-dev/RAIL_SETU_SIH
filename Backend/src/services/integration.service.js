const prisma = require("../config/prisma");
const { ApiError, parsePagination, optionalString, parseRange } = require("../utils/validation.util");
const logger = require("../utils/logger");
const { registry } = require("../integration/sources/registry");
const { SOURCE_NAMES, SOURCE_META, MODE, DISCLAIMER } = require("../integration/config");

const MAINTENANCE_SOURCES = ["TMS", "SMMS", "TDMS"];
const MAINTENANCE_SOURCE_DEPARTMENTS = {
  TMS: "ENGINEERING",
  SMMS: "SIGNAL",
  TDMS: "TRACTION",
};

let syncInProgress = false;

function serializeRun(run) {
  if (!run) return null;
  return {
    sync_run_id: run.sync_run_id,
    triggered_by: run.triggered_by,
    status: run.status,
    started_at: run.started_at,
    completed_at: run.completed_at,
    summary: run.summary,
    errors: run.errors || [],
  };
}

async function describeSources() {
  return {
    mode: MODE,
    disclaimer: DISCLAIMER,
    sources: registry.list().map((source) => ({
      code: source.code,
      name: source.name,
      department: source.department,
      description: source.description,
      mode: source.mode,
      timeout_ms: source.timeout_ms,
    })),
  };
}

function validateSourceList(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return SOURCE_NAMES.slice();
  const unique = [...new Set(sources.map((s) => String(s).toUpperCase()))];
  for (const code of unique) {
    if (!registry.has(code)) {
      throw new ApiError(400, `Unknown source "${code}". Allowed sources: ${SOURCE_NAMES.join(", ")}`);
    }
  }
  return unique;
}

async function runSync({ sources: requestedSources, triggeredBy = "MANUAL" } = {}) {
  if (syncInProgress) {
    throw new ApiError(409, "A source-data synchronization run is already in progress");
  }
  const sources = validateSourceList(requestedSources);
  syncInProgress = true;
  const startedAt = new Date();
  const run = await prisma.sourceSyncRun.create({
    data: { triggered_by: triggeredBy, status: "RUNNING", started_at: startedAt },
  });
  try {
    const summary = {};
    const errors = [];
    for (const code of sources) {
      const source = registry.get(code);
      try {
        const result = await source.ingest({ runId: run.sync_run_id });
        summary[code] = result;
        if (result.status === "FAILED") {
          errors.push({ source: code, message: result.error || "Source ingest failed" });
        } else if (result.invalid_count > 0) {
          errors.push({
            source: code,
            message: `${result.invalid_count} record(s) rejected by validation (see ${code} summary)`,
          });
        }
        logger.info(`[integration] ${code} sync -> ${result.status} (imported=${result.imported}, updated=${result.updated}, invalid=${result.invalid_count || 0})`);
      } catch (err) {
        logger.error(`[integration] ${code} sync failed`, err);
        summary[code] = { status: "FAILED", error: err.message };
        errors.push({ source: code, message: err.message });
      }
    }

    const statuses = sources.map((code) => summary[code] && summary[code].status);
    const overall =
      statuses.every((s) => s === "SUCCESS")
        ? "COMPLETED"
        : statuses.every((s) => s === "FAILED")
          ? "FAILED"
          : "PARTIAL";

    const completedAt = new Date();
    const updated = await prisma.sourceSyncRun.update({
      where: { sync_run_id: run.sync_run_id },
      data: { status: overall, completed_at: completedAt, summary, errors },
    });

    return {
      ...serializeRun(updated),
      mode: MODE,
      disclaimer: DISCLAIMER,
      duration_ms: completedAt.getTime() - startedAt.getTime(),
    };
  } finally {
    syncInProgress = false;
  }
}

async function latestSyncRun() {
  const run = await prisma.sourceSyncRun.findFirst({ orderBy: { sync_run_id: "desc" } });
  return serializeRun(run);
}

function listSyncRuns(query = {}) {
  const { page, limit, skip } = parsePagination(query, { fallbackLimit: 10 });
  return Promise.all([
    prisma.sourceSyncRun.findMany({
      where: {
        status: optionalString(query.status) || undefined,
      },
      orderBy: { sync_run_id: "desc" },
      skip,
      take: limit,
    }),
    prisma.sourceSyncRun.count({
      where: {
        status: optionalString(query.status) || undefined,
      },
    }),
  ]).then(([items, total]) => ({ items: items.map(serializeRun), total, page, limit }));
}

async function getIncomingRequestsSummary() {
  const groups = await prisma.maintenanceTask.groupBy({
    by: ["source"],
    where: { source: { in: MAINTENANCE_SOURCES } },
    _count: { _all: true },
  });
  const bySource = {
    TMS: 0,
    SMMS: 0,
    TDMS: 0,
  };
  let total = 0;
  for (const group of groups) {
    bySource[group.source] = group._count._all;
    total += group._count._all;
  }
  const departments = {};
  for (const code of MAINTENANCE_SOURCES) {
    departments[code] = {
      department: MAINTENANCE_SOURCE_DEPARTMENTS[code],
      source_name: SOURCE_META[code].name,
      count: bySource[code],
    };
  }
  return { total, bySource, departments };
}

async function listIncomingRequests(query = {}) {
  const { page, limit, skip } = parsePagination(query, { fallbackLimit: 20 });
  const where = {
    source: { in: MAINTENANCE_SOURCES },
  };
  const source = optionalString(query.source);
  if (source) where.source = source;
  const status = optionalString(query.status);
  if (status) where.status = status;
  const department = optionalString(query.department);
  if (department) where.department = department;
  const urgency = optionalString(query.urgency);
  if (urgency) where.urgency = parseRange(urgency, "urgency", 1, 4);
  const criticality = optionalString(query.criticality);
  if (criticality) where.criticality = parseRange(criticality, "criticality", 1, 4);
  if (optionalString(query.overdueOnly)) {
    const now = new Date();
    where.deadline = { not: null, lt: now };
  }

  const [items, total] = await Promise.all([
    prisma.maintenanceTask.findMany({
      where,
      include: {
        asset: true,
        block: { include: { track: true } },
        section: true,
      },
      orderBy: [{ priority: "desc" }, { deadline: "asc" }],
      skip,
      take: limit,
    }),
    prisma.maintenanceTask.count({ where }),
  ]);

  const now = new Date();
  const mapped = items.map((task) => ({
    maintenance_task_id: task.maintenance_task_id,
    source: task.source,
    external_ref: task.external_ref,
    department: task.department,
    maintenance_type: task.maintenance_type,
    description: task.description,
    priority: task.priority,
    criticality: task.criticality,
    urgency: task.urgency,
    duration_minutes: task.duration_minutes,
    requested_at: task.requested_at,
    preferred_start: task.preferred_start,
    deadline: task.deadline,
    status: task.status,
    overdue: Boolean(task.deadline && task.deadline < now && ["PENDING", "APPROVED"].includes(task.status)),
    asset: task.asset
      ? { asset_code: task.asset.asset_code, asset_name: task.asset.asset_name, asset_type: task.asset.asset_type }
      : null,
    block: task.block
      ? {
          block_code: task.block.block_code,
          track_code: task.block.track ? task.block.track.track_code : null,
          section_code: task.block.track && task.block.track.section ? task.block.track.section.section_code : task.section ? task.section.section_code : null,
        }
      : null,
    section: task.section ? { section_code: task.section.section_code, section_name: task.section.section_name } : null,
  }));

  const response = {
    items: mapped,
    total,
    page,
    limit,
    summary: await getIncomingRequestsSummary(),
  };
  return response;
}

async function getCoaData() {
  const lastSync = await latestSyncRun();
  const [blocks, timetable, goods] = await Promise.all([
    prisma.sourceRecord.findMany({
      where: { source: "COA", record_type: "BLOCK_AVAILABILITY" },
      orderBy: { imported_at: "desc" },
      take: 50,
    }),
    prisma.sourceRecord.findMany({
      where: { source: "COA", record_type: "TRAIN_TIMETABLE" },
      orderBy: { imported_at: "desc" },
      take: 500,
    }),
    prisma.goodsTrainForecast.findMany({
      where: { source: "COA" },
      include: { section: true },
      orderBy: [{ forecast_date: "asc" }, { external_ref: "asc" }],
      take: 500,
    }),
  ]);

  const raw = (payload) => (payload && typeof payload === "object" ? payload : null);

  return {
    last_sync: lastSync,
    mode: MODE,
    disclaimer: DISCLAIMER,
    blocks: blocks.map((b) => raw(b.payload)),
    timetable: timetable.map((t) => raw(t.payload)),
    goods_forecast: goods.map((g) => ({
      external_ref: g.external_ref,
      forecast_date: g.forecast_date,
      section_code: g.section ? g.section.section_code : null,
      section_name: g.section ? g.section.section_name : null,
      train_number: g.train_number,
      service: g.service,
      direction: g.direction,
      origin_station_code: g.origin_station_code,
      destination_station_code: g.destination_station_code,
      planned_tonnes: g.planned_tonnes,
      rake_count: g.rake_count,
      start_window: g.start_window,
      end_window: g.end_window,
      status: g.status,
    })),
  };
}

async function listSyncErrors(query = {}) {
  const { page, limit, skip } = parsePagination(query, { fallbackLimit: 20 });
  const run = await prisma.sourceSyncRun.findFirst({ orderBy: { sync_run_id: "desc" } });
  if (!run || !Array.isArray(run.errors) || run.errors.length === 0) {
    return { items: [], total: 0, page, limit, run: run ? serializeRun(run) : null };
  }
  const source = optionalString(query.source);
  const filtered = source ? run.errors.filter((e) => e.source === source) : run.errors;
  const total = filtered.length;
  return { items: filtered.slice(skip, skip + limit), total, page, limit, run: serializeRun(run) };
}

module.exports = {
  describeSources,
  runSync,
  latestSyncRun,
  listSyncRuns,
  getCoaData,
  getIncomingRequestsSummary,
  listIncomingRequests,
  listSyncErrors,
};