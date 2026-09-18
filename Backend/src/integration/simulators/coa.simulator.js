const { MODE, DISCLAIMER } = require("../config");
const { loadReference, iso } = require("./reference");

// Corridor Operations & Availability simulator. Represents the daily corridor
// picture for the planning horizon: block availability, passenger timetable
// and goods-train forecast. Deterministic per day so syncs are idempotent.
const COA_BLOCK_CODES = [
  "B001", "B002", "B003", "B004", "B005", "B006", "B007", "B008",
  "B009", "B010", "B011", "B012", "B013", "B014", "B015",
];

const COA_TRAIN_NUMBERS = [
  "12301", "12002", "18237", "14623", "12951", "12903", "12925",
  "54311", "12472", "19037",
];

const COA_SERVICE_DAY = "2026-09-19";

// Block codes that COA marks unavailable (consistent with TDMS/seed overlap).
const UNAVAILABLE_BLOCKS = {
  B012: "TDMS emergency traction maintenance (OHE dropper) — TDMS-REQ-001",
};

// Goods train forecast for the horizon. Uses freight-service style train ids
// where known, otherwise a composed service id.
const GOODS_CATALOG = [
  {
    externalRef: "GFA-001",
    forecastDate: "2026-09-20",
    sectionCode: "SEC-BCPN",
    trainNumber: "GCT-01",
    service: "COAL",
    direction: "UP",
    originStationCode: "BCT",
    destinationStationCode: "PUNE",
    plannedTonnes: 2400,
    rakeCount: 4,
    slotStart: "02:00",
    slotEnd: "06:30",
    status: "ACTIVE",
  },
  {
    externalRef: "GFA-002",
    forecastDate: "2026-09-21",
    sectionCode: "SEC-DLJP",
    trainNumber: "CD-09",
    service: "CONTAINER",
    direction: "DN",
    originStationCode: "DEE",
    destinationStationCode: "NDLS",
    plannedTonnes: 800,
    rakeCount: 2,
    slotStart: "10:00",
    slotEnd: "12:30",
    status: "ACTIVE",
  },
  {
    externalRef: "GFA-003",
    forecastDate: "2026-09-21",
    sectionCode: "SEC-MBLK",
    trainNumber: "FK-14",
    service: "FERTILIZER",
    direction: "UP",
    originStationCode: "MB",
    destinationStationCode: "LKO",
    plannedTonnes: 1200,
    rakeCount: 2,
    slotStart: "21:00",
    slotEnd: "23:30",
    status: "ACTIVE",
  },
  {
    externalRef: "GFA-004",
    forecastDate: "2026-09-22",
    sectionCode: "SEC-DLJP",
    trainNumber: "PK-03",
    service: "PARCEL",
    direction: "DN",
    originStationCode: "NDLS",
    destinationStationCode: "DEE",
    plannedTonnes: 400,
    rakeCount: 1,
    slotStart: "05:30",
    slotEnd: "07:00",
    status: "ACTIVE",
  },
  {
    externalRef: "GFA-005",
    forecastDate: "2026-09-22",
    sectionCode: "SEC-DLAM",
    trainNumber: "BL-07",
    service: "BALLAST",
    direction: "UP",
    originStationCode: "DLI",
    destinationStationCode: "UMB",
    plannedTonnes: 900,
    rakeCount: 2,
    slotStart: "13:00",
    slotEnd: "16:30",
    status: "ACTIVE",
  },
  {
    externalRef: "GFA-006",
    forecastDate: "2026-09-23",
    sectionCode: "SEC-BCAH",
    trainNumber: "CL-21",
    service: "COAL",
    direction: "UP",
    originStationCode: "ADI",
    destinationStationCode: "ST",
    plannedTonnes: 3000,
    rakeCount: 5,
    slotStart: "09:00",
    slotEnd: "14:00",
    status: "ACTIVE",
  },
  {
    externalRef: "GFA-007",
    forecastDate: "2026-09-23",
    sectionCode: "SEC-MBLK",
    trainNumber: "PT-05",
    service: "PETROLEUM",
    direction: "DN",
    originStationCode: "BE",
    destinationStationCode: "MB",
    plannedTonnes: 1000,
    rakeCount: 2,
    slotStart: "03:00",
    slotEnd: "05:30",
    status: "ACTIVE",
  },
  {
    externalRef: "GFA-008",
    forecastDate: "2026-09-24",
    sectionCode: "SEC-DLJP",
    trainNumber: "CD-11",
    service: "CONTAINER",
    direction: "UP",
    originStationCode: "NDLS",
    destinationStationCode: "DEE",
    plannedTonnes: 900,
    rakeCount: 2,
    slotStart: "18:00",
    slotEnd: "20:30",
    status: "ACTIVE",
  },
];

function slotWindow(forecastDate, time) {
  return new Date(`${forecastDate}T${time}:00Z`);
}

async function load() {
  const ref = await loadReference();
  return ref;
}

async function buildBlocks(ref) {
  const rows = [];
  for (const code of COA_BLOCK_CODES) {
    const block = ref.blockByCode.get(code);
    if (!block) continue;
    const unavailable = UNAVAILABLE_BLOCKS[code];
    rows.push({
      block_code: block.block_code,
      track_code: block.track ? block.track.track_code : null,
      section_code: block.track && block.track.section ? block.track.section.section_code : null,
      status: unavailable ? "UNAVAILABLE" : block.status || "AVAILABLE",
      availability: unavailable ? "UNAVAILABLE" : "AVAILABLE",
      effective_from: COA_SERVICE_DAY,
      effective_to: COA_SERVICE_DAY,
      reason: unavailable ? `${unavailable} — corridor slot held until work completion` : null,
    });
  }
  return rows;
}

async function buildTimetable(ref) {
  const rows = [];
  for (const train of ref.trains) {
    if (!COA_TRAIN_NUMBERS.includes(train.train_number)) continue;
    for (const stop of train.train_routes) {
      rows.push({
        train_number: train.train_number,
        train_name: train.train_name,
        train_type: train.train_type,
        schedule_day: COA_SERVICE_DAY,
        sequence_number: stop.sequence_number,
        station_code: stop.station.station_code,
        scheduled_arrival: stop.scheduled_arrival,
        scheduled_departure: stop.scheduled_departure,
      });
    }
  }
  return rows;
}

async function buildGoodsForecast() {
  return GOODS_CATALOG.map((g) => ({
    external_ref: g.externalRef,
    forecast_date: g.forecastDate,
    section_code: g.sectionCode,
    train_number: g.trainNumber,
    service: g.service,
    direction: g.direction,
    origin_station_code: g.originStationCode,
    destination_station_code: g.destinationStationCode,
    planned_tonnes: g.plannedTonnes,
    rake_count: g.rakeCount,
    start_window: slotWindow(g.forecastDate, g.slotStart),
    end_window: slotWindow(g.forecastDate, g.slotEnd),
    status: g.status,
  }));
}

async function getData() {
  const ref = await load();
  const blocks = await buildBlocks(ref);
  const timetable = await buildTimetable(ref);
  const goods_forecast = await buildGoodsForecast();

  return {
    system: "COA",
    system_name: "Corridor Operations & Availability",
    mode: MODE,
    disclaimer: DISCLAIMER,
    generated_at: iso(),
    service_day: COA_SERVICE_DAY,
    block_count: blocks.length,
    timetable_count: timetable.length,
    goods_forecast_count: goods_forecast.length,
    blocks,
    timetable,
    goods_forecast,
  };
}

module.exports = { coaSimulator: { getData }, COA_SERVICE_DAY };