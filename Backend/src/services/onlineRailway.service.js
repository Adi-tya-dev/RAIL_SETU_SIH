"use strict";

const https = require("https");
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const conflictDetection = require("./conflictDetection.service");

const TRAINS_URL = "https://raw.githubusercontent.com/datameet/railways/master/trains.json";
const STATIONS_URL = "https://raw.githubusercontent.com/datameet/railways/master/stations.json";

function fetchJsonFromUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP Status ${res.statusCode}`));
      }
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on("error", reject);
  });
}

function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Generate sequential TrainBlockMovement records for a train based on its scheduled station routes.
 */
async function generateBlockMovementsForTrain(trainId) {
  const train = await prisma.train.findUnique({
    where: { train_id: BigInt(trainId) },
    include: {
      train_routes: {
        include: { station: { include: { section: true } } },
        orderBy: { sequence_number: "asc" },
      },
    },
  });

  if (!train || !train.train_routes || train.train_routes.length === 0) return 0;

  const routes = train.train_routes;
  const allBlocks = await prisma.block.findMany({
    include: { track: { include: { section: true } } },
    orderBy: { start_chainage: "asc" },
  });

  // Group blocks by section_id
  const blocksBySection = new Map();
  for (const blk of allBlocks) {
    const sId = blk.track?.section_id ? String(blk.track.section_id) : null;
    if (sId) {
      if (!blocksBySection.has(sId)) blocksBySection.set(sId, []);
      blocksBySection.get(sId).push(blk);
    }
  }

  // Clear existing movements for clean rebuild
  await prisma.trainBlockMovement.deleteMany({ where: { train_id: train.train_id } });

  const createdMovements = [];
  const usedBlockIds = new Set();
  const baseTime = routes[0].scheduled_departure
    ? new Date(routes[0].scheduled_departure)
    : new Date("2026-09-18T06:00:00Z");

  for (let i = 0; i < routes.length - 1; i++) {
    const fromStop = routes[i];
    const toStop = routes[i + 1];

    const entryTime = fromStop.scheduled_departure
      ? new Date(fromStop.scheduled_departure)
      : new Date(baseTime.getTime() + i * 2 * 3600 * 1000);
    const exitTime = toStop.scheduled_arrival
      ? new Date(toStop.scheduled_arrival)
      : new Date(entryTime.getTime() + 1.5 * 3600 * 1000);

    const fromSectionId = fromStop.station?.section_id ? String(fromStop.station.section_id) : null;
    const toSectionId = toStop.station?.section_id ? String(toStop.station.section_id) : null;

    let candidateBlocks = (fromSectionId && blocksBySection.get(fromSectionId)) || [];
    if (candidateBlocks.length === 0 && toSectionId) {
      candidateBlocks = blocksBySection.get(toSectionId) || [];
    }
    if (candidateBlocks.length === 0) {
      // Fallback: round-robin over active blocks so every leg is assigned a corridor block
      const blkIdx = (Number(train.train_id) + i) % allBlocks.length;
      candidateBlocks = [allBlocks[blkIdx]];
    }

    // Pick 1-2 blocks along this leg
    const blocksForLeg = candidateBlocks.slice(0, 2);
    const legDuration = Math.max(exitTime.getTime() - entryTime.getTime(), 30 * 60 * 1000);
    const slotDuration = legDuration / blocksForLeg.length;

    for (let bIdx = 0; bIdx < blocksForLeg.length; bIdx++) {
      const blk = blocksForLeg[bIdx];
      if (!blk) continue;

      const blkEntry = new Date(entryTime.getTime() + bIdx * slotDuration);
      const blkExit = new Date(blkEntry.getTime() + slotDuration);

      // Create block movement
      try {
        await prisma.trainBlockMovement.create({
          data: {
            train_id: train.train_id,
            block_id: blk.block_id,
            scheduled_entry: blkEntry,
            scheduled_exit: blkExit,
          },
        });
        usedBlockIds.add(String(blk.block_id));
        createdMovements.push(blk.block_id);
      } catch (err) {
        logger.debug(`[onlineRailway] Movement insert skipped: ${err.message}`);
      }
    }
  }

  return createdMovements.length;
}

/**
 * Ensures all trains in the database have valid routes and block movements.
 * Backfills any train lacking train_routes or train_block_movements.
 */
async function backfillAllTrainData() {
  logger.info("[onlineRailway] Backfilling missing routes and movements for all database trains...");

  // Load online features for lookup if needed
  let trainFeatures = [];
  let stationLookup = new Map();
  try {
    const [trainsData, stationsData] = await Promise.all([
      fetchJsonFromUrl(TRAINS_URL),
      fetchJsonFromUrl(STATIONS_URL),
    ]);
    trainFeatures = trainsData.features || (Array.isArray(trainsData) ? trainsData : []);
    const stationFeatures = stationsData.features || (Array.isArray(stationsData) ? stationsData : []);

    for (const feat of stationFeatures) {
      const p = feat.properties;
      const geom = feat.geometry;
      if (p && p.code && geom && Array.isArray(geom.coordinates)) {
        const code = String(p.code).trim().toUpperCase();
        stationLookup.set(code, {
          code,
          name: String(p.name || code).trim(),
          lng: geom.coordinates[0],
          lat: geom.coordinates[1],
        });
      }
    }
  } catch (err) {
    logger.warn(`[onlineRailway] Could not fetch online dataset during backfill: ${err.message}`);
  }

  const featureMap = new Map();
  for (const feat of trainFeatures) {
    if (feat.properties && feat.properties.number) {
      featureMap.set(String(feat.properties.number).trim(), feat);
    }
  }

  const allSections = await prisma.section.findMany();
  const sectionsByCode = new Map(allSections.map((s) => [s.section_code, s]));
  const defaultFallbackSection = sectionsByCode.get("SEC-CTRDL") || allSections[0];

  function getSectionForCoord(lat, lng) {
    if (lat == null || lng == null) return defaultFallbackSection;
    if (lat < 16.5 && lng < 77.5) return sectionsByCode.get("SEC-SWRLN") || defaultFallbackSection;
    if (lat >= 12.0 && lat <= 14.2 && lng >= 77.0 && lng <= 80.5) return sectionsByCode.get("SEC-BNMS") || defaultFallbackSection;
    if (lat >= 14.8 && lat < 18.2 && lng >= 75.0 && lng < 78.0) return sectionsByCode.get("SEC-GTLSR") || defaultFallbackSection;
    if (lat >= 18.5 && lat <= 19.8 && lng >= 72.5 && lng <= 73.5) return sectionsByCode.get("SEC-MUMTN") || defaultFallbackSection;
    if (lat >= 18.0 && lat <= 19.5 && lng > 73.5 && lng <= 74.8) return sectionsByCode.get("SEC-BCPN") || defaultFallbackSection;
    if (lat > 19.5 && lat <= 24.5 && lng >= 69.0 && lng <= 73.5) return sectionsByCode.get("SEC-WRML") || defaultFallbackSection;
    if (lat >= 24.5 && lat <= 29.5 && lng >= 70.0 && lng <= 76.0) return sectionsByCode.get("SEC-RJWNDL") || defaultFallbackSection;
    if (lat >= 16.0 && lat <= 22.0 && lng >= 80.0 && lng <= 87.5) return sectionsByCode.get("SEC-ECLN") || defaultFallbackSection;
    if (lat >= 24.0 && lat <= 28.5 && lng >= 88.0 && lng <= 96.0) return sectionsByCode.get("SEC-NEFR") || defaultFallbackSection;
    if (lat >= 22.0 && lat <= 26.0 && lng >= 83.5 && lng <= 88.5) return sectionsByCode.get("SEC-GRDCH") || defaultFallbackSection;
    if (lat >= 25.0 && lat <= 28.0 && lng >= 81.5 && lng <= 84.5) return sectionsByCode.get("SEC-UPER") || defaultFallbackSection;
    if (lat >= 26.5 && lat <= 29.0 && lng >= 78.5 && lng <= 81.5) return sectionsByCode.get("SEC-MBLK") || defaultFallbackSection;
    if (lat >= 28.5 && lat <= 30.5 && lng >= 76.5 && lng <= 77.8) return sectionsByCode.get("SEC-DLAM") || defaultFallbackSection;
    if (lat > 30.5 && lng >= 74.0 && lng <= 77.5) return sectionsByCode.get("SEC-DLNORTH") || defaultFallbackSection;
    if (lat >= 17.0 && lat <= 21.5 && lng >= 77.5 && lng <= 80.0) return sectionsByCode.get("SEC-HYDNGP") || defaultFallbackSection;
    if (lat >= 20.0 && lat <= 22.5 && lng >= 78.5 && lng <= 84.0) return sectionsByCode.get("SEC-EWCN") || defaultFallbackSection;
    return defaultFallbackSection;
  }

  const allStations = await prisma.station.findMany();
  const stationByCode = new Map(allStations.map((s) => [s.station_code, s]));

  async function ensureStation(code, fallbackName, coords) {
    if (!code) return null;
    const cleanCode = String(code).trim().toUpperCase();
    if (stationByCode.has(cleanCode)) return stationByCode.get(cleanCode);

    const info = stationLookup.get(cleanCode);
    const name = (info && info.name) || fallbackName || cleanCode;
    const lat = info ? info.lat : (coords ? coords[1] : 20.0);
    const lng = info ? info.lng : (coords ? coords[0] : 78.0);
    const matchedSection = getSectionForCoord(lat, lng);

    try {
      const st = await prisma.station.create({
        data: {
          section_id: matchedSection.section_id,
          station_code: cleanCode,
          station_name: name,
          latitude: lat,
          longitude: lng,
        },
      });
      stationByCode.set(cleanCode, st);
      return st;
    } catch (e) {
      const existing = await prisma.station.findUnique({ where: { station_code: cleanCode } });
      if (existing) stationByCode.set(cleanCode, existing);
      return existing;
    }
  }

  const trains = await prisma.train.findMany({
    include: {
      train_routes: true,
      train_block_movements: true,
      origin_station: true,
      destination_station: true,
    },
  });

  const now = new Date("2026-09-18T06:00:00Z");
  let routesBackfilled = 0;
  let movementsBackfilled = 0;

  for (const train of trains) {
    let routes = train.train_routes || [];

    // 1. Backfill train_routes if missing
    if (routes.length === 0) {
      const feat = featureMap.get(train.train_number);
      let waypoints = [];

      if (feat) {
        const props = feat.properties || {};
        const coords = feat.geometry?.coordinates || [];

        const fromStation = await ensureStation(props.from_station_code, props.from_station_name, coords[0]);
        const toStation = await ensureStation(props.to_station_code, props.to_station_name, coords[coords.length - 1]);

        if (fromStation && toStation) {
          waypoints.push(fromStation);
          if (coords.length > 2) {
            const step = Math.floor(coords.length / 4);
            for (let c = 1; c < coords.length - 1; c += Math.max(step, 1)) {
              const coord = coords[c];
              const numPart = train.train_number.slice(0, 5);
              const wpCode = `W${numPart}_${c}`.slice(0, 10);
              let wpStation = await ensureStation(wpCode, `Waypoint ${c} (${train.train_number})`, coord);
              if (wpStation) waypoints.push(wpStation);
              if (waypoints.length >= 6) break;
            }
          }
          waypoints.push(toStation);

          // Update origin/destination stations on Train
          await prisma.train.update({
            where: { train_id: train.train_id },
            data: {
              origin_station_id: fromStation.station_id,
              destination_station_id: toStation.station_id,
            },
          });
        }
      }

      // If still no waypoints, synthesize from prominent existing stations
      if (waypoints.length < 2) {
        const defaultCodes = ["NDLS", "CNB", "PRYJ", "DDU", "HWH"];
        for (const code of defaultCodes) {
          const st = stationByCode.get(code);
          if (st) waypoints.push(st);
        }
        if (waypoints.length >= 2) {
          await prisma.train.update({
            where: { train_id: train.train_id },
            data: {
              origin_station_id: waypoints[0].station_id,
              destination_station_id: waypoints[waypoints.length - 1].station_id,
            },
          });
        }
      }

      if (waypoints.length >= 2) {
        for (let seq = 0; seq < waypoints.length; seq++) {
          const st = waypoints[seq];
          const arrTime = seq === 0 ? null : new Date(now.getTime() + seq * 2 * 3600 * 1000);
          const depTime = seq === waypoints.length - 1 ? null : new Date(now.getTime() + (seq * 2 + 0.2) * 3600 * 1000);

          await prisma.trainRoute.create({
            data: {
              train_id: train.train_id,
              station_id: st.station_id,
              sequence_number: seq + 1,
              scheduled_arrival: arrTime,
              scheduled_departure: depTime,
            },
          });
        }
        routesBackfilled++;
      }
    }

    // 2. Backfill train_block_movements if missing
    const currentMoves = await prisma.trainBlockMovement.count({ where: { train_id: train.train_id } });
    if (currentMoves === 0) {
      const generated = await generateBlockMovementsForTrain(train.train_id);
      if (generated > 0) movementsBackfilled++;
    }
  }

  logger.info(`[onlineRailway] Backfill complete: ${routesBackfilled} routes backfilled, ${movementsBackfilled} trains given block movements.`);

  // Auto-detect and persist conflicts right after backfill so map displays all conflicts
  await conflictDetection.ensureConflicts(true);

  return {
    total_trains: trains.length,
    routes_backfilled: routesBackfilled,
    movements_backfilled: movementsBackfilled,
  };
}

/**
 * Fetches real Indian Railways trains with their geographic stations and routes.
 * Populates Train, Station, TrainRoute, and TrainBlockMovement in PostgreSQL.
 * @param {number} limit Number of trains to ingest
 */
async function fetchAndSyncOnlineTrains(limit = 30) {
  logger.info(`[onlineRailway] Fetching Indian Railways data from web repository...`);

  // 1. Fetch trains and stations in parallel
  const [trainsData, stationsData] = await Promise.all([
    fetchJsonFromUrl(TRAINS_URL),
    fetchJsonFromUrl(STATIONS_URL),
  ]);

  const trainFeatures = trainsData.features || (Array.isArray(trainsData) ? trainsData : []);
  const stationFeatures = stationsData.features || (Array.isArray(stationsData) ? stationsData : []);

  // Build station lookup map by station code: code -> { name, lat, lng }
  const stationLookup = new Map();
  for (const feat of stationFeatures) {
    const p = feat.properties;
    const geom = feat.geometry;
    if (p && p.code && geom && Array.isArray(geom.coordinates)) {
      const code = String(p.code).trim().toUpperCase();
      stationLookup.set(code, {
        code,
        name: String(p.name || code).trim(),
        lng: geom.coordinates[0],
        lat: geom.coordinates[1],
      });
    }
  }

  // Ensure default fallback section exists for foreign stations
  let fallbackSection = await prisma.section.findFirst({ where: { section_code: "SEC-CTRDL" } });
  if (!fallbackSection) {
    fallbackSection = await prisma.section.findFirst();
  }

  // Helper to ensure a station exists in PostgreSQL
  async function ensureStation(code, fallbackName, coords) {
    if (!code) return null;
    const cleanCode = String(code).trim().toUpperCase();
    let st = await prisma.station.findUnique({ where: { station_code: cleanCode } });
    if (st) return st;

    const info = stationLookup.get(cleanCode);
    const name = (info && info.name) || fallbackName || cleanCode;
    const lat = info ? info.lat : (coords ? coords[1] : 20.0);
    const lng = info ? info.lng : (coords ? coords[0] : 78.0);

    try {
      st = await prisma.station.create({
        data: {
          section_id: fallbackSection.section_id,
          station_code: cleanCode,
          station_name: name,
          latitude: lat,
          longitude: lng,
        },
      });
      return st;
    } catch (e) {
      return await prisma.station.findUnique({ where: { station_code: cleanCode } });
    }
  }

  // Prioritize any trains currently missing routes or long-distance trains
  const missingTrainRecords = await prisma.train.findMany({
    where: { train_routes: { none: {} } },
    select: { train_number: true },
  });
  const missingNumbers = new Set(missingTrainRecords.map((t) => t.train_number));

  const priorityCandidates = trainFeatures.filter(
    (f) => f.properties && missingNumbers.has(String(f.properties.number).trim())
  );

  const longRouteTrains = trainFeatures
    .filter((f) => f.properties && f.properties.number && f.geometry && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length > 2)
    .sort((a, b) => (Number(b.properties.distance || 0) - Number(a.properties.distance || 0)));

  // Combine missing trains first, then long route candidates
  const combined = [...priorityCandidates];
  const seenNumbers = new Set(priorityCandidates.map((f) => String(f.properties?.number).trim()));
  for (const feat of longRouteTrains) {
    const num = String(feat.properties?.number).trim();
    if (!seenNumbers.has(num)) {
      seenNumbers.add(num);
      combined.push(feat);
    }
  }

  const candidates = combined.length > 0 ? combined : trainFeatures;
  let imported = 0;
  let updated = 0;
  const now = new Date("2026-09-18T06:00:00Z");

  for (let i = 0; i < Math.min(candidates.length, limit); i++) {
    const feat = candidates[i];
    const props = feat.properties;
    const coords = feat.geometry?.coordinates || [];

    const trainNumber = String(props.number).trim();
    const trainName = String(props.name || "Express Train").trim();
    const trainType = String(props.type || "EXPRESS").toUpperCase();
    const priority = trainType.includes("RAJDHANI") || trainType.includes("SHATABDI") ? 1 : 2;

    const fromCode = props.from_station_code ? String(props.from_station_code).trim().toUpperCase() : null;
    const toCode = props.to_station_code ? String(props.to_station_code).trim().toUpperCase() : null;

    try {
      const fromStation = await ensureStation(fromCode, props.from_station_name, coords[0]);
      const toStation = await ensureStation(toCode, props.to_station_name, coords[coords.length - 1]);

      let train = await prisma.train.findUnique({
        where: { train_number: trainNumber },
      });

      if (train) {
        train = await prisma.train.update({
          where: { train_number: trainNumber },
          data: {
            train_name: trainName,
            train_type: trainType,
            origin_station_id: fromStation ? fromStation.station_id : undefined,
            destination_station_id: toStation ? toStation.station_id : undefined,
            priority,
            status: "ACTIVE",
          },
        });
        updated++;
      } else {
        train = await prisma.train.create({
          data: {
            train_number: trainNumber,
            train_name: trainName,
            train_type: trainType,
            origin_station_id: fromStation ? fromStation.station_id : null,
            destination_station_id: toStation ? toStation.station_id : null,
            priority,
            status: "ACTIVE",
          },
        });
        imported++;
      }

      // Generate realistic route stations from the geometric line coordinates
      const existingRoutes = await prisma.trainRoute.count({ where: { train_id: train.train_id } });
      if (existingRoutes === 0 && fromStation && toStation) {
        const waypoints = [fromStation];

        if (coords.length > 2) {
          const step = Math.floor(coords.length / 4);
          for (let c = 1; c < coords.length - 1; c += Math.max(step, 1)) {
            const coord = coords[c];
            const numPart = trainNumber.slice(0, 5);
            const wpCode = `W${numPart}_${c}`.slice(0, 10);
            let wpStation = await prisma.station.findUnique({ where: { station_code: wpCode } });
            if (!wpStation) {
              wpStation = await prisma.station.create({
                data: {
                  section_id: fallbackSection.section_id,
                  station_code: wpCode,
                  station_name: `Waypoint ${c} (${trainNumber})`,
                  latitude: coord[1],
                  longitude: coord[0],
                },
              });
            }
            waypoints.push(wpStation);
            if (waypoints.length >= 6) break;
          }
        }
        waypoints.push(toStation);

        // Insert into trainRoute
        for (let seq = 0; seq < waypoints.length; seq++) {
          const st = waypoints[seq];
          const arrTime = seq === 0 ? null : new Date(now.getTime() + seq * 2 * 3600 * 1000);
          const depTime = seq === waypoints.length - 1 ? null : new Date(now.getTime() + (seq * 2 + 0.2) * 3600 * 1000);

          await prisma.trainRoute.create({
            data: {
              train_id: train.train_id,
              station_id: st.station_id,
              sequence_number: seq + 1,
              scheduled_arrival: arrTime,
              scheduled_departure: depTime,
            },
          });
        }
      }

      // Automatically generate block movements for this train
      await generateBlockMovementsForTrain(train.train_id);
    } catch (err) {
      logger.warn(`[onlineRailway] Error syncing train ${trainNumber}: ${err.message}`);
    }
  }

  // Ensure all database trains are fully populated
  await backfillAllTrainData();

  logger.info(`[onlineRailway] Online train sync finished: ${imported} imported, ${updated} updated.`);

  return {
    source_url: TRAINS_URL,
    total_available_in_dataset: trainFeatures.length,
    processed: Math.min(candidates.length, limit),
    imported,
    updated,
    synced_at: new Date().toISOString(),
  };
}

async function getOnlineStatus() {
  const count = await prisma.train.count();
  const routeCount = await prisma.trainRoute.count();
  const movementCount = await prisma.trainBlockMovement.count();
  return {
    online_source: TRAINS_URL,
    status: "CONNECTED",
    database_train_count: count,
    routes_count: routeCount,
    movements_count: movementCount,
  };
}

module.exports = {
  fetchAndSyncOnlineTrains,
  backfillAllTrainData,
  generateBlockMovementsForTrain,
  getOnlineStatus,
};
