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

const COA_RECORD_TYPES = {
  BLOCK_AVAILABILITY: "BLOCK_AVAILABILITY",
  TIMETABLE: "TRAIN_TIMETABLE",
  GOODS_FORECAST: "GOODS_FORECAST",
};

const ALLOWED_AVAILABILITY = new Set(["AVAILABLE", "AVAILABLE_WITH_RESTRICTIONS", "UNAVAILABLE"]);

function validateBlock(row) {
  const errors = [];
  const blockCode = requireString(row.block_code, "block_code");
  const availability = String(row.availability || "AVAILABLE").toUpperCase();
  if (!ALLOWED_AVAILABILITY.has(availability)) {
    errors.push(`block ${blockCode}: availability "${row.availability}" is not valid`);
  }
  if (!row.effective_from) row.effective_from = null;
  if (!row.effective_to) row.effective_to = null;
  if (errors.length) return { ok: false, ref: blockCode, errors };
  const sourceRef = `BLK-${blockCode}-${row.effective_from || "all"}`;
  return {
    ok: true,
    ref: sourceRef,
    record: {
      source_ref: sourceRef,
      block_code: blockCode,
      status: availability === "UNAVAILABLE" ? "UNAVAILABLE" : availability,
      availability,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      reason: row.reason || null,
      raw: row,
    },
  };
}

function validateTimetable(row) {
  const errors = [];
  const trainNumber = requireString(row.train_number, "train_number");
  const stationCode = requireString(row.station_code, "station_code");
  let sequence = 1;
  try {
    sequence = clampInt(row.sequence_number, "sequence_number", 1, 999);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    errors.push(message);
  }
  // Arrival/departure are optional: source rows may legitimately carry
  // only one leg (origin departure or destination arrival only).
  const scheduledArrival = parseDate(row.scheduled_arrival, "scheduled_arrival");
  const scheduledDeparture = parseDate(row.scheduled_departure, "scheduled_departure");
  if (errors.length) return { ok: false, ref: `${trainNumber}@${stationCode}`, errors };
  const sourceRef = `TT-${trainNumber}-${String(sequence).padStart(3, "0")}`;
  return {
    ok: true,
    ref: sourceRef,
    record: {
      source_ref: sourceRef,
      train_number: trainNumber,
      train_name: row.train_name || null,
      train_type: row.train_type || null,
      schedule_day: row.schedule_day || null,
      sequence_number: sequence,
      station_code: stationCode,
      scheduled_arrival: scheduledArrival || null,
      scheduled_departure: scheduledDeparture || null,
      raw: row,
    },
  };
}

function validateGoods(row) {
  const errors = [];
  const externalRef = requireString(row.external_ref, "external_ref");
  const sectionCode = requireString(row.section_code, "section_code");
  const service = requireString(row.service, "service");
  let forecastDate = null;
  try {
    forecastDate = parseDate(`${String(row.forecast_date).slice(0, 10)}T00:00:00Z`, "forecast_date");
    if (!forecastDate) throw new SourceError("INVALID_FIELD", "forecast_date is required");
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    errors.push(`goods ${externalRef}: ${message}`);
  }
  let startWindow = null;
  let endWindow = null;
  try {
    startWindow = parseDate(row.start_window, "start_window");
    endWindow = parseDate(row.end_window, "end_window");
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    errors.push(`goods ${externalRef}: ${message}`);
  }
  if (startWindow && endWindow && startWindow >= endWindow) {
    errors.push(`goods ${externalRef}: start_window must precede end_window`);
  }
  let plannedTonnes = null;
  let rakeCount = null;
  try {
    plannedTonnes = row.planned_tonnes == null ? null : clampInt(row.planned_tonnes, "planned_tonnes", 1, 100000);
    rakeCount = row.rake_count == null ? null : clampInt(row.rake_count, "rake_count", 1, 1000);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    errors.push(`goods ${externalRef}: ${message}`);
  }
  if (errors.length) return { ok: false, ref: externalRef, errors };
  return {
    ok: true,
    ref: externalRef,
    record: {
      source_ref: externalRef,
      external_ref: externalRef,
      forecast_date: forecastDate,
      section_code: sectionCode,
      train_number: row.train_number || null,
      service,
      direction: row.direction || null,
      origin_station_code: row.origin_station_code || null,
      destination_station_code: row.destination_station_code || null,
      planned_tonnes: plannedTonnes,
      rake_count: rakeCount,
      start_window: startWindow,
      end_window: endWindow,
      status: row.status || "ACTIVE",
      raw: row,
    },
  };
}

function validatePayload(payload) {
  if (!isPlainObject(payload)) {
    throw new SourceError("INVALID_PAYLOAD", "COA returned a non-object payload");
  }
  const invalid = [];
  const records = [];
  const lists = [
    ["blocks", validateBlock, COA_RECORD_TYPES.BLOCK_AVAILABILITY],
    ["timetable", validateTimetable, COA_RECORD_TYPES.TIMETABLE],
    ["goods_forecast", validateGoods, COA_RECORD_TYPES.GOODS_FORECAST],
  ];
  for (const [key, validator, recordType] of lists) {
    const list = payload[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      try {
        const result = validator(item);
        if (result.ok) records.push({ ...result.record, record_type: recordType });
        else invalid.push({ ref: result.ref, record_type: recordType, errors: result.errors });
      } catch (err) {
        invalid.push({ ref: item && item.external_ref ? item.external_ref : "", record_type: recordType, errors: [err.message] });
      }
    }
  }
  return { records, invalid };
}

async function persistBlock(tx, record, ref, runId) {
  const block = ref.blockByCode.get(record.block_code);
  if (!block) return { status: "invalid", ref: record.source_ref, error: `Block "${record.block_code}" not found` };
  const available = record.availability === "AVAILABLE" || record.availability === "AVAILABLE_WITH_RESTRICTIONS";
  await tx.block.update({
    where: { block_code: block.block_code },
    data: { status: record.status, availability: available },
  });
  await tx.sourceRecord.create({
    data: {
      sync_run: { connect: { sync_run_id: runId } },
      source: "COA",
      record_type: COA_RECORD_TYPES.BLOCK_AVAILABILITY,
      source_ref: record.source_ref,
      status: "IMPORTED",
      block: { connect: { block_id: block.block_id } },
      payload: record.raw,
    },
  });
  return { status: "imported" };
}

async function persistTimetable(tx, record, ref, runId) {
  const train = ref.trainByNumber.get(record.train_number);
  if (!train) return { status: "invalid", ref: record.source_ref, error: `Train "${record.train_number}" not found` };
  await tx.sourceRecord.create({
    data: {
      sync_run: { connect: { sync_run_id: runId } },
      source: "COA",
      record_type: COA_RECORD_TYPES.TIMETABLE,
      source_ref: record.source_ref,
      status: "IMPORTED",
      train: { connect: { train_id: train.train_id } },
      payload: record.raw,
    },
  });
  return { status: "imported" };
}

async function persistGoods(tx, record, ref, runId) {
  const section = ref.sectionByCode.get(record.section_code);
  if (!section) return { status: "invalid", ref: record.source_ref, error: `Section "${record.section_code}" not found` };
  const existing = await tx.goodsTrainForecast.findUnique({
    where: { external_ref: record.external_ref },
    select: { goods_forecast_id: true },
  });
  await tx.goodsTrainForecast.upsert({
    where: { external_ref: record.external_ref },
    update: {
      forecast_date: record.forecast_date,
      section_id: section.section_id,
      train_number: record.train_number,
      service: record.service,
      direction: record.direction,
      origin_station_code: record.origin_station_code,
      destination_station_code: record.destination_station_code,
      planned_tonnes: record.planned_tonnes,
      rake_count: record.rake_count,
      start_window: record.start_window,
      end_window: record.end_window,
      status: record.status,
    },
    create: {
      external_ref: record.external_ref,
      source: "COA",
      forecast_date: record.forecast_date,
      section_id: section.section_id,
      train_number: record.train_number,
      service: record.service,
      direction: record.direction,
      origin_station_code: record.origin_station_code,
      destination_station_code: record.destination_station_code,
      planned_tonnes: record.planned_tonnes,
      rake_count: record.rake_count,
      start_window: record.start_window,
      end_window: record.end_window,
      status: record.status,
    },
  });
  await tx.sourceRecord.create({
    data: {
      sync_run: { connect: { sync_run_id: runId } },
      source: "COA",
      record_type: COA_RECORD_TYPES.GOODS_FORECAST,
      source_ref: record.source_ref,
      status: "IMPORTED",
      payload: record.raw,
    },
  });
  return { status: existing ? "updated" : "imported" };
}

function createCoaSource({ simulator, timeoutMs = env.sourceFetchTimeoutMs }) {
  const meta = SOURCE_META.COA;

  return {
    code: "COA",
    name: meta.name,
    department: meta.department,
    mode: MODE,
    disclaimer: DISCLAIMER,
    description: meta.description,
    timeout_ms: timeoutMs,

    async ingest({ runId }) {
      let payload;
      try {
        payload = await fetchWithTimeout(simulator, "COA", timeoutMs);
      } catch (err) {
        return { status: "FAILED", imported: 0, updated: 0, invalid: [], error: "COA fetch failed" };
      }

      let records;
      let invalid;
      try {
        ({ records, invalid } = validatePayload(payload));
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
            const result =
              record.record_type === COA_RECORD_TYPES.BLOCK_AVAILABILITY
                ? await persistBlock(tx, record, ref, runId)
                : record.record_type === COA_RECORD_TYPES.TIMETABLE
                  ? await persistTimetable(tx, record, ref, runId)
                  : await persistGoods(tx, record, ref, runId);
            if (result.status === "invalid") rejected.push({ ref: result.ref, error: result.error });
            else if (result.status === "imported") imported += 1;
            else updated += 1;
          }
        });
      } catch (err) {
        return {
          status: "FAILED",
          imported: 0,
          updated: 0,
          invalid: [...invalid, ...rejected],
          error: `Failed to persist COA records: ${err.message}`,
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

module.exports = { createCoaSource, validatePayload };