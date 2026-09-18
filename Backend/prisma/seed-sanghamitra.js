const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const BASE = new Date("2026-09-15T00:00:00Z");
function at(hours) {
  return new Date(BASE.getTime() + hours * 60 * 60 * 1000);
}

// Real-world stations with real coordinates, in Sanghamitra Express (12313)
// itinerary order: KSR Bengaluru City -> Danapur via Chennai/Vijayawada/Nagpur.
const STATIONS = [
  { code: "SMVB", name: "KSR Bengaluru City", lat: 12.9791, lng: 77.5904, section: "SEC-BNMS" },
  { code: "KJM", name: "Krishnarajapuram", lat: 12.9892, lng: 77.6781, section: "SEC-BNMS" },
  { code: "BWT", name: "Bangarapet", lat: 12.9860, lng: 78.1440, section: "SEC-BNMS" },
  { code: "JTJ", name: "Jolarpettai", lat: 12.5670, lng: 78.5810, section: "SEC-BNMS" },
  { code: "SA", name: "Salem Junction", lat: 11.6540, lng: 78.1440, section: "SEC-BNMS" },
  { code: "ED", name: "Erode Junction", lat: 11.3410, lng: 77.7280, section: "SEC-BNMS" },
  { code: "TPJ", name: "Tiruchirappalli", lat: 10.7960, lng: 78.6880, section: "SEC-BNMS" },
  { code: "TPTY", name: "Tirupati", lat: 13.6270, lng: 79.4100, section: "SEC-BNMS" },
  { code: "MAS", name: "Chennai Central", lat: 13.0827, lng: 80.2747, section: "SEC-CNDP" },
  { code: "NLR", name: "Nellore", lat: 14.4400, lng: 79.9860, section: "SEC-CNDP" },
  { code: "BZA", name: "Vijayawada Junction", lat: 16.5200, lng: 80.6200, section: "SEC-CNDP" },
  { code: "KMM", name: "Khammam", lat: 17.2510, lng: 80.1560, section: "SEC-CNDP" },
  { code: "WL", name: "Warangal", lat: 17.9680, lng: 79.6060, section: "SEC-CNDP" },
  { code: "BPQ", name: "Balharshah", lat: 19.8570, lng: 79.3670, section: "SEC-CNDP" },
  { code: "NGP", name: "Nagpur", lat: 21.1470, lng: 79.0890, section: "SEC-CNDP" },
  { code: "JBP", name: "Jabalpur", lat: 23.1630, lng: 79.9460, section: "SEC-CNDP" },
  { code: "KTE", name: "Katni Junction", lat: 23.7910, lng: 80.3920, section: "SEC-CNDP" },
  { code: "MKP", name: "Manikpur", lat: 25.0590, lng: 81.1150, section: "SEC-CNDP" },
  { code: "PRYJ", name: "Prayagraj Junction", lat: 25.4460, lng: 81.8490, section: "SEC-CNDP" },
  { code: "DDU", name: "Pt. Deen Dayal Upadhyaya", lat: 25.2830, lng: 82.6030, section: "SEC-CNDP" },
  { code: "DNR", name: "Danapur", lat: 25.6050, lng: 85.0270, section: "SEC-CNDP" },
];

// Scheduled stop times (hours from BASE). null dep = terminal, null arr = origin.
const ROUTE = [
  ["SMVB", null, 21.0],
  ["KJM", 21.25, 21.3],
  ["BWT", 22.2, 22.3],
  ["JTJ", 23.2, 23.3],
  ["SA", 24.6, 24.75],
  ["ED", 25.5, 25.6],
  ["TPJ", 26.6, 26.7],
  ["TPTY", 28.8, 28.9],
  ["MAS", 30.2, 30.8],
  ["NLR", 33.0, 33.1],
  ["BZA", 35.5, 35.7],
  ["KMM", 37.5, 37.6],
  ["WL", 39.0, 39.1],
  ["BPQ", 42.3, 42.4],
  ["NGP", 45.0, 45.2],
  ["JBP", 48.8, 48.9],
  ["KTE", 50.4, 50.5],
  ["MKP", 53.0, 53.1],
  ["PRYJ", 54.8, 54.9],
  ["DDU", 57.5, 57.6],
  ["DNR", 60.3, null],
];

// Blocks per section (chainage km). One UNDER_REPAIR to keep ops realistic.
const BLOCKS = [
  ["TR-007", "B101", 0, 220, "AVAILABLE"],
  ["TR-007", "B102", 220, 500, "AVAILABLE"],
  ["TR-007", "B103", 500, 800, "AVAILABLE"],
  ["TR-007", "B104", 800, 1420, "AVAILABLE"],
  ["TR-008", "B105", 0, 350, "AVAILABLE"],
  ["TR-008", "B106", 350, 700, "AVAILABLE"],
  ["TR-008", "B107", 700, 1100, "UNDER_REPAIR"],
  ["TR-008", "B108", 1100, 1500, "AVAILABLE"],
  ["TR-008", "B109", 1500, 2100, "AVAILABLE"],
];

// Approx block occupancy window (hours from BASE) spanning the ~39h journey.
const MOVES = [
  ["B101", 21.0, 22.2],
  ["B102", 22.2, 24.2],
  ["B103", 24.2, 26.4],
  ["B104", 26.4, 30.4],
  ["B105", 30.4, 34.6],
  ["B106", 34.6, 38.6],
  ["B107", 38.6, 42.2],
  ["B108", 42.2, 47.6],
  ["B109", 47.6, 61.0],
];

async function main() {
  const existing = await prisma.train.findFirst({ where: { train_number: "12313" } });
  if (existing) {
    console.log("12313 Sanghamitra Express already seeded. Skipping.");
    return;
  }

  // Zones / divisions (additive - reuse existing when present)
  const sr = await prisma.zone.upsert({ where: { zone_code: "SR" }, update: {}, create: { zone_code: "SR", zone_name: "Southern Railway" } });
  const ecr = await prisma.zone.upsert({ where: { zone_code: "ECR" }, update: {}, create: { zone_code: "ECR", zone_name: "East Central Railway" } });
  const ben = await prisma.division.upsert({ where: { division_code: "BEN" }, update: {}, create: { zone_id: sr.zone_id, division_code: "BEN", division_name: "Bengaluru Division" } });
  const dnrDiv = await prisma.division.upsert({ where: { division_code: "DNR" }, update: {}, create: { zone_id: ecr.zone_id, division_code: "DNR", division_name: "Danapur Division" } });

  // Sections
  const secBnms = "SEC-BNMS";
  let bnms = await prisma.section.findFirst({ where: { section_code: secBnms } });
  if (!bnms) bnms = await prisma.section.create({ data: { division_id: ben.division_id, section_code: secBnms, section_name: "Bengaluru-Chennai Main", start_chainage: 0, end_chainage: 1420 } });
  let cndp = await prisma.section.findFirst({ where: { section_code: "SEC-CNDP" } });
  if (!cndp) cndp = await prisma.section.create({ data: { division_id: dnrDiv.division_id, section_code: "SEC-CNDP", section_name: "Chennai-Danapur Main", start_chainage: 0, end_chainage: 2100 } });
  const sectionByCode = { "SEC-BNMS": bnms, "SEC-CNDP": cndp };

  // Station created (unique by code) -> keep map
  const stationRecords = {};
  for (const s of STATIONS) {
    let rec = await prisma.station.findFirst({ where: { station_code: s.code } });
    if (!rec) {
      rec = await prisma.station.create({
        data: { section_id: sectionByCode[s.section].section_id, station_code: s.code, station_name: s.name, latitude: s.lat, longitude: s.lng },
      });
    }
    stationRecords[s.code] = rec;
  }
  console.log("Sanghamitra stations:", Object.keys(stationRecords).length);

  // Tracks
  let tr007 = await prisma.track.findFirst({ where: { track_code: "TR-007" } });
  if (!tr007) tr007 = await prisma.track.create({ data: { section_id: bnms.section_id, track_code: "TR-007", track_name: "Bengaluru-Chennai Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" } });
  let tr008 = await prisma.track.findFirst({ where: { track_code: "TR-008" } });
  if (!tr008) tr008 = await prisma.track.create({ data: { section_id: cndp.section_id, track_code: "TR-008", track_name: "Chennai-Danapur Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" } });
  const trackByCode = { "TR-007": tr007, "TR-008": tr008 };

  // Blocks
  const blockRecords = {};
  for (const [trackCode, code, start, end, status] of BLOCKS) {
    if (await prisma.block.findFirst({ where: { block_code: code } })) continue;
    const rec = await prisma.block.create({
      data: { track_id: trackByCode[trackCode].track_id, block_code: code, start_chainage: start, end_chainage: end, status, availability: status === "AVAILABLE" },
    });
    blockRecords[code] = rec;
  }

  // Train
  const train = await prisma.train.create({
    data: {
      train_number: "12313",
      train_name: "Sanghamitra Express",
      train_type: "MAIL_EXPRESS",
      origin_station_id: stationRecords.SMVB.station_id,
      destination_station_id: stationRecords.DNR.station_id,
      priority: 3,
      status: "ACTIVE",
    },
  });

  // Routes (full itinerary, ordered sequence)
  let seq = 1;
  for (const [code, arr, dep] of ROUTE) {
    await prisma.trainRoute.create({
      data: {
        train_id: train.train_id,
        station_id: stationRecords[code].station_id,
        sequence_number: seq,
        scheduled_arrival: arr != null ? at(arr) : null,
        scheduled_departure: dep != null ? at(dep) : null,
      },
    });
    seq += 1;
  }
  console.log("Sanghamitra routes:", ROUTE.length);

  // Block movements
  for (const [blockCode, entryH, exitH] of MOVES) {
    const block = blockRecords[blockCode] || (await prisma.block.findFirst({ where: { block_code: blockCode } }));
    if (!block) continue;
    await prisma.trainBlockMovement.create({
      data: { train_id: train.train_id, block_id: block.block_id, scheduled_entry: at(entryH), scheduled_exit: at(exitH) },
    });
  }
  console.log("Sanghamitra movements:", MOVES.length);

  console.log("Seeded Sanghamitra Express (12313): SMVB -> DNR,", ROUTE.length, "stops");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());