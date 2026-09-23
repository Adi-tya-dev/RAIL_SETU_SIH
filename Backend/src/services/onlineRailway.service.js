"use strict";

const https = require("https");
const prisma = require("../config/prisma");
const logger = require("../utils/logger");

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

/**
 * Fetches real Indian Railways trains with their geographic stations and routes.
 * Populates Train, Station, and TrainRoute in PostgreSQL.
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

  // Filter for high-value/long-distance trains (e.g. coordinates length > 4 or distance > 400km)
  const longRouteTrains = trainFeatures
    .filter((f) => f.properties && f.properties.number && f.geometry && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length > 2)
    .sort((a, b) => (Number(b.properties.distance || 0) - Number(a.properties.distance || 0)));

  const candidates = longRouteTrains.length > 0 ? longRouteTrains : trainFeatures;
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
      // Every train needs at least 2 stations (origin, destination, plus intermediate waypoints)
      const existingRoutes = await prisma.trainRoute.count({ where: { train_id: train.train_id } });
      if (existingRoutes === 0 && fromStation && toStation) {
        const waypoints = [fromStation];

        // Sample up to 4 intermediate coordinates along the real line
        if (coords.length > 2) {
          const step = Math.floor(coords.length / 4);
          for (let c = 1; c < coords.length - 1; c += Math.max(step, 1)) {
            const coord = coords[c];
            // Station code is VARCHAR(10) - ensure code fits in 10 chars
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
    } catch (err) {
      logger.warn(`[onlineRailway] Error syncing train ${trainNumber}: ${err.message}`);
    }
  }

  logger.info(`[onlineRailway] Online long-distance sync finished: ${imported} imported, ${updated} updated.`);

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
  return {
    online_source: TRAINS_URL,
    status: "CONNECTED",
    database_train_count: count,
    routes_count: routeCount,
  };
}

module.exports = {
  fetchAndSyncOnlineTrains,
  getOnlineStatus,
};
