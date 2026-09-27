const prisma = require("../../config/prisma");
const seedData = require("../../services/seedData.provider");

// Loads the reference catalogue from the database so the simulators emit
// logically consistent payloads (only real assets/blocks/sections/trains).
// The simulation is deterministic: the same catalogue produces the same
// request codes (TMS-REQ-001 ...) every run, which makes syncs idempotent.
async function loadReference() {
  let assets, blocks, sections, trains, stations;

  try {
    const results = await Promise.all([
      prisma.asset.findMany({
        select: {
          asset_id: true,
          asset_code: true,
          asset_name: true,
          asset_type: true,
          block_id: true,
          section_id: true,
          status: true,
          criticality: true,
        },
      }),
      prisma.block.findMany({
        select: {
          block_id: true,
          block_code: true,
          track: {
            select: {
              track_code: true,
              section: { select: { section_code: true } },
            },
          },
          status: true,
          availability: true,
        },
      }),
      prisma.section.findMany({
        select: { section_id: true, section_code: true, section_name: true },
      }),
      prisma.train.findMany({
        select: {
          train_id: true,
          train_number: true,
          train_name: true,
          train_type: true,
          train_routes: {
            orderBy: { sequence_number: "asc" },
            select: {
              sequence_number: true,
              station: { select: { station_code: true } },
              scheduled_arrival: true,
              scheduled_departure: true,
            },
          },
        },
      }),
      prisma.station.findMany({
        select: { station_code: true, station_name: true },
      }),
    ]);
    [assets, blocks, sections, trains, stations] = results;
  } catch (err) {
    console.warn(`[simulator/reference] DB fetch failed, falling back to seed data: ${err.message}`);
    assets = seedData.assets;
    blocks = seedData.blocks;
    sections = seedData.sections;
    trains = seedData.trains;
    stations = seedData.stations;
  }

  return {
    assets,
    blocks,
    sections,
    trains,
    stations,
    assetByCode: new Map(assets.map((a) => [a.asset_code, a])),
    blockByCode: new Map(blocks.map((b) => [b.block_code, b])),
    sectionByCode: new Map(sections.map((s) => [s.section_code, s])),
    trainByNumber: new Map(trains.map((t) => [t.train_number, t])),
    stationByCode: new Map(stations.map((s) => [s.station_code, s])),
  };
}

// Planning window used by the source data (aligned with the seed BASE).
const todayDate = new Date();
todayDate.setUTCHours(0, 0, 0, 0);
const BASE_ISO = todayDate.toISOString();

function iso(date = new Date()) {
  return date.toISOString();
}

module.exports = { loadReference, BASE_ISO, iso };