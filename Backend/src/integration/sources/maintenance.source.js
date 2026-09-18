const {
  fetchWithTimeout,
  parseDate,
  clampInt,
  requireString,
  loadReference,
  SOURCE_META,
  MODE,
  DISCLAIMER,
  SourceError,
  isPlainObject,
  iso,
} = require("./base.source");
const { runInTransaction } = require("../../services/transaction.service");
const env = require("../../config/env");

const MAINTENANCE_RECORD_TYPES = {
  REQUEST: "MAINTENANCE_REQUEST",
};

// Length-limited string helper to keep payloads lean.
function truncate(value, max) {
  const s = String(value == null ? "" : value).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function validateMaintenanceRecord({ code, department }, raw) {
  const errors = [];
  const externalRef = requireString(raw.request_id || raw.external_ref, "request_id");
  const maintenanceType = requireString(raw.maintenance_type, "maintenance_type");
  const assetCode = requireString(raw.asset_code, "asset_code");

  let priority = 1;
  let criticality = 1;
  let urgency = 1;
  let durationMinutes = 0;
  try {
    priority = clampInt(raw.priority, "priority", 1, 4);
    criticality = clampInt(raw.criticality, "criticality", 1, 4);
    urgency = clampInt(raw.urgency, "urgency", 1, 4);
    durationMinutes = clampInt(raw.duration_minutes, "duration_minutes", 1, 1440);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    errors.push(message);
  }

  let requestedAt;
  let preferredStart;
  let deadline;
  try {
    requestedAt = parseDate(raw.requested_at, "requested_at") || new Date();
    preferredStart = parseDate(raw.preferred_start, "preferred_start");
    deadline = parseDate(raw.deadline, "deadline");
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    errors.push(message);
  }

  if (errors.length > 0) {
    return { ok: false, ref: externalRef, errors };
  }

  return {
    ok: true,
    ref: externalRef,
    record: {
      source: code,
      department,
      external_ref: externalRef,
      work_order: truncate(raw.work_order, 64) || null,
      category: truncate(raw.category, 30) || "ROUTINE",
      maintenance_type: maintenanceType,
      description: truncate(raw.description, 500) || null,
      asset_code: assetCode,
      block_code: truncate(raw.block_code, 20) || null,
      section_code: truncate(raw.section_code, 20) || null,
      priority,
      criticality,
      urgency,
      duration_minutes: durationMinutes,
      requested_at: requestedAt,
      preferred_start: preferredStart || null,
      deadline: deadline || null,
      status: truncate(raw.status, 30) || "PENDING",
      overdue: Boolean(raw.overdue),
      raw: raw,
    },
  };
}

function validatePayload({ code, department }, payload) {
  const invalid = [];
  if (!isPlainObject(payload)) {
    throw new SourceError("INVALID_PAYLOAD", `${code} returned a non-object payload`);
  }
  if (!Array.isArray(payload.tasks)) {
    throw new SourceError("INVALID_PAYLOAD", `${code} payload has no "tasks" array`);
  }
  const records = [];
  for (const raw of payload.tasks) {
    const result = validateMaintenanceRecord({ code, department }, raw);
    if (result.ok) records.push(result.record);
    else invalid.push({ ref: result.ref, errors: result.errors });
  }
  return { records, invalid };
}

async function resolveTargets(ref, record) {
  const asset = ref.assetByCode.get(record.asset_code);
  if (!asset) {
    return { error: `Asset "${record.asset_code}" does not exist in reference data` };
  }
  let blockId = asset.block_id;
  if (record.block_code) {
    const block = ref.blockByCode.get(record.block_code);
    if (!block) return { error: `Block "${record.block_code}" does not exist in reference data` };
    blockId = block.block_id;
  }
  const sectionId = ref.sectionByCode.get(record.section_code)
    ? ref.sectionByCode.get(record.section_code).section_id
    : asset.section_id;
  return { asset_id: asset.asset_id, block_id: blockId, section_id: sectionId };
}

async function persistRecord(tx, meta, record, ref, runId) {
  const targets = await resolveTargets(ref, record);
  if (targets.error) {
    return { status: "invalid", ref: record.external_ref, error: targets.error };
  }

  const existing = await tx.maintenanceTask.findUnique({
    where: { source_external_ref: { source: record.source, external_ref: record.external_ref } },
    select: { maintenance_task_id: true },
  });

  const task = await tx.maintenanceTask.upsert({
    where: { source_external_ref: { source: record.source, external_ref: record.external_ref } },
    update: {
      asset_id: targets.asset_id,
      block_id: targets.block_id,
      section_id: targets.section_id,
      department: record.department,
      maintenance_type: record.maintenance_type,
      description: record.description,
      priority: record.priority,
      criticality: record.criticality,
      urgency: record.urgency,
      duration_minutes: record.duration_minutes,
      requested_at: record.requested_at,
      preferred_start: record.preferred_start,
      deadline: record.deadline,
      status: record.status,
    },
    create: {
      asset_id: targets.asset_id,
      block_id: targets.block_id,
      section_id: targets.section_id,
      department: record.department,
      maintenance_type: record.maintenance_type,
      description: record.description,
      priority: record.priority,
      criticality: record.criticality,
      urgency: record.urgency,
      duration_minutes: record.duration_minutes,
      requested_at: record.requested_at,
      preferred_start: record.preferred_start,
      deadline: record.deadline,
      status: record.status,
      source: record.source,
      external_ref: record.external_ref,
    },
  });

  await tx.sourceRecord.deleteMany({
    where: {
      source: record.source,
      source_ref: record.external_ref,
      record_type: MAINTENANCE_RECORD_TYPES.REQUEST,
    },
  });
  await tx.sourceRecord.create({
    data: {
      sync_run: { connect: { sync_run_id: runId } },
      source: record.source,
      record_type: MAINTENANCE_RECORD_TYPES.REQUEST,
      source_ref: record.external_ref,
      status: "IMPORTED",
      maintenance_task: { connect: { maintenance_task_id: task.maintenance_task_id } },
      asset: { connect: { asset_id: targets.asset_id } },
      block: { connect: { block_id: targets.block_id } },
      payload: record.raw,
    },
  });

  return { status: existing ? "updated" : "imported" };
}

function createMaintenanceSource({ code, simulator, timeoutMs = env.sourceFetchTimeoutMs }) {
  const meta = SOURCE_META[code];
  if (!meta) throw new Error(`Unknown maintenance source ${code}`);

  return {
    code,
    name: meta.name,
    department: meta.department,
    mode: MODE,
    disclaimer: DISCLAIMER,
    description: meta.description,
    timeout_ms: timeoutMs,

    async ingest({ runId }) {
      let payload;
      try {
        payload = await fetchWithTimeout(simulator, code, timeoutMs);
      } catch (err) {
        return {
          status: "FAILED",
          imported: 0,
          updated: 0,
          invalid: [],
          error: `${code} fetch failed`,
        };
      }

      let records;
      let invalid;
      try {
        ({ records, invalid } = validatePayload({ code, department: meta.department }, payload));
      } catch (err) {
        return { status: "FAILED", imported: 0, updated: 0, invalid: [], error: err.message };
      }

      let imported = 0;
      let updated = 0;
      const rejected = [];
      try {
        await runInTransaction(async (tx) => {
          const ref = await loadReference();
          for (const record of records) {
            const result = await persistRecord(tx, meta, record, ref, runId);
            if (result.status === "invalid") {
              rejected.push({ ref: result.ref, error: result.error });
            } else if (result.status === "imported") {
              imported += 1;
            } else {
              updated += 1;
            }
          }
          return { imported, updated };
        });
      } catch (err) {
        return {
          status: "FAILED",
          imported: 0,
          updated: 0,
          invalid: [...invalid, ...rejected],
          error: `Failed to persist ${code} records: ${err.message}`,
        };
      }

      const allInvalid = [...invalid, ...rejected];
      const hasInvalid = allInvalid.length > 0 && imported + updated > 0;
      const hasCompleteFailure = allInvalid.length > 0 && imported + updated === 0;

      return {
        status: hasCompleteFailure ? "FAILED" : hasInvalid ? "PARTIAL" : "SUCCESS",
        imported,
        updated,
        invalid: allInvalid,
        invalid_count: allInvalid.length,
        records: records.length,
        fetched_at: iso(),
      };
    },
  };
}

module.exports = { createMaintenanceSource, validateMaintenanceRecord, validatePayload };