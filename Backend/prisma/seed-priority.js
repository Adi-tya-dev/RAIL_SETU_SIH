const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const BASE = new Date("2026-09-18T00:00:00Z");
const DWELL_HOURS = 0.25;

// [number, name, type, priority, startHour, routeCodes, speedKmh]
// priority (service priority, LOWER = released first):
//   1 Vande Bharat / Rajdhani, 3 Mail/Express, 4 Passenger, 5 Local/Suburban MEMU/DEMU
const TRAINS = [
  // --- Vande Bharat / high-speed (priority 1) ---
  [20901, "Vande Bharat Express", "VANDE_BHARAT", 1, 6, ["PRYJ", "CNB", "NDLS"], 90],
  [20605, "Vande Bharat Express", "VANDE_BHARAT", 1, 8, ["MAS", "KJM", "SBC"], 95],
  [22435, "Vande Bharat Express", "VANDE_BHARAT", 1, 7, ["NDLS", "AGC", "BSL", "PUNE", "BCT"], 100],
  [22439, "Vande Bharat Express", "VANDE_BHARAT", 1, 10, ["HWH", "GAYA", "CNB", "NDLS"], 95],
  // --- Local / suburban (priority 5) ---
  [64421, "Delhi-Ambala MEMU", "MEMU", 5, 15, ["NDLS", "DEE", "UMB"], 45],
  [64425, "Mumbai Shuttle MEMU", "MEMU", 5, 14, ["CSMT", "PNVL", "PUNE"], 45],
  [66451, "Chennai-Nellore MEMU", "MEMU", 5, 6, ["MAS", "GDR", "NLR"], 45],
  [66551, "Chennai-Bangalore MEMU", "MEMU", 5, 12, ["MAS", "KJM", "KPD", "SBC"], 45],
  [74201, "Bangalore-Katpadi DEMU", "DEMU", 5, 17, ["SBC", "KPD"], 50],
  [75601, "Guwahati-Bongaigaon DEMU", "DEMU", 5, 20, ["GHY", "NBQ"], 50],
  [64301, "Mumbai-Ahmedabad Passenger", "PASSENGER", 4, 11, ["BCT", "ADI"], 45],
  [64411, "Delhi-Kanpur Passenger", "PASSENGER", 4, 5, ["NDLS", "CNB"], 50],
];

function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function main() {
  const stationByCode = new Map((await prisma.station.findMany()).map((s) => [s.station_code, s]));
  const sectionIdToCode = new Map((await prisma.section.findMany()).map((s) => [s.section_id, s.section_code]));

  // First-block lookup per section (block with the smallest start_chainage).
  const sections = await prisma.section.findMany({ include: { tracks: true } });
  const firstBlockBySection = {};
  for (const section of sections) {
    if (!section.tracks.length) continue;
    const first = await prisma.block.findFirst({
      where: { track: { section_id: section.section_id } },
      orderBy: { start_chainage: "asc" },
    });
    if (first) firstBlockBySection[section.section_code] = first;
  }

  let created = 0;
  let moveRows = 0;
  for (const [number, name, type, priority, startH, routeCodes, speed] of TRAINS) {
    const stops = routeCodes.map((code) => stationByCode.get(code));
    if (stops.some((s) => !s)) throw new Error(`Missing station for train ${number}`);
    const coords = stops.map((rec) => [Number(rec.latitude), Number(rec.longitude)]);

    const departures = [startH];
    for (let i = 1; i < stops.length; i += 1) {
      const leg = distanceKm(coords[i - 1], coords[i]);
      const arrival = departures[i - 1] + leg / speed;
      const isTerminal = i === stops.length - 1;
      departures.push(isTerminal ? arrival : arrival + DWELL_HOURS);
    }
    const arrivals = [null];
    for (let i = 1; i < stops.length; i += 1) {
      const leg = distanceKm(coords[i - 1], coords[i]);
      arrivals.push(departures[i - 1] + leg / speed);
    }

    let train = await prisma.train.findUnique({ where: { train_number: String(number) } });
    if (!train) {
      train = await prisma.train.create({
        data: {
          train_number: String(number),
          train_name: name,
          train_type: type,
          origin_station_id: stops[0].station_id,
          destination_station_id: stops[stops.length - 1].station_id,
          priority,
          status: "ACTIVE",
        },
      });
      created += 1;
      for (let i = 0; i < stops.length; i += 1) {
        await prisma.trainRoute.create({
          data: {
            train_id: train.train_id,
            station_id: stops[i].station_id,
            sequence_number: i + 1,
            scheduled_arrival: arrivals[i] != null ? new Date(BASE.getTime() + arrivals[i] * 3600000) : null,
            scheduled_departure: departures[i] != null ? new Date(BASE.getTime() + departures[i] * 3600000) : null,
          },
        });
      }
    }

    // Recompute movements (idempotent) - one block-occupancy window per route leg.
    const sectionOf = stops.map((rec) => rec.section_id);
    // Stations may sit in different sections than neighbours, so use each leg's own
    // section (destination's, falling back to source's) rather than section runs.
    await prisma.trainBlockMovement.deleteMany({ where: { train_id: train.train_id } });
    for (let i = 1; i < stops.length; i += 1) {
      const fromCode = sectionIdToCode.get(sectionOf[i - 1]);
      const toCode = sectionIdToCode.get(sectionOf[i]);
      const sectionCode = toCode || fromCode;
      const block = firstBlockBySection[sectionCode];
      if (!block) continue;
      const t0 = new Date(BASE.getTime() + departures[i - 1] * 3600000);
      const t1 = new Date(BASE.getTime() + arrivals[i] * 3600000);
      if (t1 <= t0) continue;
      await prisma.trainBlockMovement.create({
        data: { train_id: train.train_id, block_id: block.block_id, scheduled_entry: t0, scheduled_exit: t1 },
      });
      moveRows += 1;
    }
    console.log(`${train.train_number} ${train.train_name} (P${train.priority} ${train.train_type})`);
  }

  console.log(`\nDONE: ${created} new trains, ${moveRows} movement rows written.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());