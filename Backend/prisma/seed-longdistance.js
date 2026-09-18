const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const BASE = new Date("2026-09-18T00:00:00Z");
const SPEED_KMPH = 55;
const DWELL_HOURS = 0.25;

// ---- New corridor sections (map section_code -> meta) ----
// Existing sections reused: SEC-BNMS, SEC-CNDP, SEC-DLAM, SEC-MBLK, SEC-BCAH.
const SECTION_META = {
  "SEC-CTRDL": { name: "Mumbai-Delhi Main", division: "DLI", chain: [0, 2000] },
  "SEC-ECLN": { name: "East Coast Main", division: "DNR", chain: [0, 2500] },
  "SEC-GRDCH": { name: "Grand Chord (Howrah-Delhi)", division: "DNR", chain: [0, 1200] },
  "SEC-EWCN": { name: "East-West Central (Kolkata-Nagpur)", division: "MZP", chain: [0, 1500] },
  "SEC-UPER": { name: "Eastern Uttar Pradesh-Gorakhpur", division: "MZP", chain: [0, 900] },
  "SEC-NEFR": { name: "Northeast Frontier (NJP-Guwahati-Dibrugarh)", division: "DNR", chain: [0, 1100] },
  "SEC-WRML": { name: "Western Main (Mumbai-Ahmedabad-Bhuj)", division: "BCT", chain: [0, 2100] },
  "SEC-RJWNDL": { name: "Jaipur-Delhi Line", division: "DLI", chain: [0, 800] },
  "SEC-DLNORTH": { name: "Delhi-North (Ambala-Ludhiana-Jammu)", division: "DLI", chain: [0, 900] },
  "SEC-GTLSR": { name: "Guntakal-Solapur-Pune", division: "BEN", chain: [0, 1000] },
  "SEC-HYDNGP": { name: "Hyderabad-Nagpur", division: "MZP", chain: [0, 800] },
  "SEC-SBCKD": { name: "Bengaluru-Katpadi-Chennai", division: "BEN", chain: [0, 500] },
  "SEC-SWRLN": { name: "Southern West Coast (TVC-Mangalore-Goa)", division: "BEN", chain: [0, 1900] },
  "SEC-MUMTN": { name: "Mumbai Terminals (CSMT-LTT-Panvel)", division: "BCT", chain: [0, 600] },
};

// ---- New stations: code -> [name, lat, lng, section] ----
const NEW_STATIONS = {
  CNB: ["Kanpur Central", 26.4499, 80.3319, "SEC-CTRDL"],
  BSL: ["Bhusaval Junction", 21.0409, 76.7637, "SEC-CTRDL"],
  ET: ["Itarsi Junction", 22.6119, 77.7689, "SEC-CTRDL"],
  BPL: ["Bhopal Junction", 23.2596, 77.4126, "SEC-CTRDL"],
  GWL: ["Gwalior Junction", 26.2124, 78.1772, "SEC-CTRDL"],
  AGC: ["Agra Cantt", 27.1767, 78.0081, "SEC-CTRDL"],
  HWH: ["Howrah Junction", 22.5833, 88.337, "SEC-ECLN"],
  SHM: ["Shalimar", 22.541, 88.297, "SEC-ECLN"],
  BLS: ["Balasore", 21.5137, 86.9316, "SEC-ECLN"],
  BBS: ["Bhubaneswar", 20.2961, 85.8245, "SEC-ECLN"],
  CTC: ["Cuttack Junction", 20.27, 85.8333, "SEC-ECLN"],
  VSKP: ["Visakhapatnam Junction", 17.7233, 83.305, "SEC-ECLN"],
  VZM: ["Vizianagaram Junction", 18.1174, 83.4241, "SEC-ECLN"],
  PURI: ["Puri", 19.813, 85.828, "SEC-ECLN"],
  DGR: ["Durgapur", 23.7046, 87.017, "SEC-GRDCH"],
  GAYA: ["Gaya Junction", 24.79, 84.999, "SEC-GRDCH"],
  KGP: ["Kharagpur Junction", 22.331, 87.3075, "SEC-EWCN"],
  TATA: ["Tatanagar Junction", 22.7718, 86.2053, "SEC-EWCN"],
  ROU: ["Rourkela", 22.2417, 84.8883, "SEC-EWCN"],
  JSG: ["Jharsuguda Junction", 21.856, 84.026, "SEC-EWCN"],
  GMO: ["Netaji SC Bose Gomoh", 23.83, 86.09, "SEC-EWCN"],
  GKP: ["Gorakhpur Junction", 26.7606, 83.3732, "SEC-UPER"],
  KIR: ["Katihar Junction", 25.5453, 87.5748, "SEC-UPER"],
  NJP: ["New Jalpaiguri", 26.7239, 88.484, "SEC-NEFR"],
  NBQ: ["New Bongaigaon", 26.3226, 90.236, "SEC-NEFR"],
  GHY: ["Guwahati", 26.183, 91.751, "SEC-NEFR"],
  LMG: ["Lumding Junction", 25.7473, 93.17, "SEC-NEFR"],
  DBRG: ["Dibrugarh", 27.4727, 94.9121, "SEC-NEFR"],
  BRC: ["Vadodara Junction", 22.31, 73.186, "SEC-WRML"],
  RTM: ["Ratlam Junction", 23.5276, 75.4362, "SEC-WRML"],
  RJT: ["Rajkot Junction", 22.3094, 70.8021, "SEC-WRML"],
  PBR: ["Porbandar", 21.6438, 69.6318, "SEC-WRML"],
  GIMB: ["Gandhidham Junction", 23.0833, 70.1333, "SEC-WRML"],
  ABR: ["Abu Road", 24.8932, 74.6224, "SEC-WRML"],
  JP: ["Jaipur Junction", 26.92, 75.808, "SEC-RJWNDL"],
  SWM: ["Sawai Madhopur Junction", 25.963, 76.34, "SEC-RJWNDL"],
  BGKT: ["Bhagat Ki Kothi (Jodhpur)", 26.2912, 73.0165, "SEC-RJWNDL"],
  LDH: ["Ludhiana Junction", 30.909, 75.854, "SEC-DLNORTH"],
  JAT: ["Jammu Tawi", 32.7266, 74.857, "SEC-DLNORTH"],
  FZR: ["Ferozpur", 30.9227, 74.795, "SEC-DLNORTH"],
  ASR: ["Amritsar Junction", 31.633, 74.873, "SEC-DLNORTH"],
  GTL: ["Guntakal Junction", 15.1682, 77.3834, "SEC-GTLSR"],
  SUR: ["Solapur Junction", 17.6619, 75.9101, "SEC-GTLSR"],
  HYB: ["Secunderabad Junction", 17.408, 78.458, "SEC-HYDNGP"],
  KZJ: ["Kazipet Junction", 17.385, 78.4867, "SEC-HYDNGP"],
  SBC: ["KSR Bengaluru City Junction", 12.9784, 77.5707, "SEC-SBCKD"],
  KPD: ["Katpadi Junction", 12.9749, 79.1705, "SEC-SBCKD"],
  GDR: ["Gudur Junction", 14.0107, 79.8472, "SEC-CNDP"],
  TVC: ["Thiruvananthapuram Central", 8.4844, 76.9405, "SEC-SWRLN"],
  QLN: ["Kollam Junction", 8.8804, 76.6027, "SEC-SWRLN"],
  ERS: ["Ernakulam Junction", 9.9704, 76.2876, "SEC-SWRLN"],
  CLT: ["Kozhikode", 11.2588, 75.7784, "SEC-SWRLN"],
  MAO: ["Madgaon Junction", 15.3981, 73.8162, "SEC-SWRLN"],
  LTT: ["Lokmanya Tilak Terminus", 19.068, 72.836, "SEC-MUMTN"],
  PNVL: ["Panvel Junction", 18.993, 73.099, "SEC-MUMTN"],
  CSMT: ["Mumbai CSMT", 18.9398, 72.8355, "SEC-MUMTN"],
};

// ---- 20 long-distance trains ----
// [number, name, type, priority, startHour (from BASE), [route codes source->destination]]
const TRAINS = [
  [12615, "Grand Trunk Express", "MAIL_EXPRESS", 3, 5, ["MAS", "GDR", "NLR", "BZA", "KZJ", "NGP", "ET", "JBP", "BPL", "GWL", "AGC", "NDLS"]],
  [12627, "Karnataka Express", "SUPERFAST", 3, 8, ["SBC", "GTL", "SUR", "BPL", "GWL", "AGC", "NDLS"]],
  [12625, "Kerala Express", "MAIL_EXPRESS", 3, 12, ["TVC", "QLN", "ERS", "CLT", "MAO", "LTT", "BSL", "BPL", "AGC", "NDLS"]],
  [12303, "Poorva Express", "MAIL_EXPRESS", 3, 16, ["HWH", "DGR", "GAYA", "DDU", "CNB", "NDLS"]],
  [12839, "Howrah-Chennai Mail", "MAIL_EXPRESS", 3, 21, ["HWH", "BLS", "BBS", "VSKP", "VZM", "BZA", "GDR", "MAS"]],
  [12163, "Chennai-Mumbai Express", "MAIL_EXPRESS", 3, 9, ["MAS", "KJM", "SBC", "GTL", "SUR", "PUNE", "CSMT"]],
  [12137, "Punjab Mail", "MAIL_EXPRESS", 3, 13, ["CSMT", "BSL", "NGP", "BPL", "AGC", "NDLS", "LDH", "FZR"]],
  [12423, "Dibrugarh Rajdhani", "RAJDHANI", 1, 7, ["NDLS", "CNB", "LKO", "GKP", "NJP", "NBQ", "GHY", "LMG", "DBRG"]],
  [12509, "Guwahati-SMVT Bengaluru SF Express", "SUPERFAST", 3, 18, ["GHY", "NBQ", "KIR", "JSG", "TATA", "VZM", "BZA", "GTL", "SBC"]],
  [15635, "Gandhidham-Guwahati Express", "EXPRESS", 3, 3, ["GIMB", "ADI", "ABR", "JP", "AGC", "CNB", "GKP", "NJP", "GHY"]],
  [12905, "West Bengal Sampark Kranti", "MAIL_EXPRESS", 3, 10, ["HWH", "KGP", "NGP", "ET", "RTM", "BRC", "ADI", "RJT", "PBR"]],
  [12308, "Howrah-Jodhpur Express", "MAIL_EXPRESS", 3, 23, ["HWH", "DGR", "GAYA", "PRYJ", "CNB", "AGC", "SWM", "JP", "BGKT"]],
  [12723, "Telangana Express", "SUPERFAST", 3, 2, ["HYB", "KZJ", "NGP", "BPL", "GWL", "AGC", "NDLS"]],
  [12801, "Purushottam Express", "MAIL_EXPRESS", 3, 6, ["PURI", "BBS", "CTC", "ROU", "TATA", "GMO", "PRYJ", "CNB", "NDLS"]],
  [12958, "Swarna Jayanti Rajdhani", "RAJDHANI", 1, 15, ["ASR", "UMB", "NDLS", "AGC", "BPL", "PUNE", "KPD", "MAS"]],
  [12967, "Jaipur-Chennai Express", "SUPERFAST", 3, 19, ["JP", "SWM", "BRC", "ST", "PUNE", "GTL", "SBC", "KPD", "MAS"]],
  [12621, "Tamil Nadu Express", "SUPERFAST", 3, 22, ["NDLS", "AGC", "BPL", "ET", "NGP", "BZA", "GDR", "MAS"]],
  [12311, "Howrah-Jammu Tawi Express", "MAIL_EXPRESS", 3, 4, ["HWH", "DGR", "GAYA", "CNB", "NDLS", "UMB", "JAT"]],
  [16346, "Netravati Express", "SUPERFAST", 3, 11, ["TVC", "QLN", "ERS", "CLT", "MAO", "PNVL", "LTT"]],
  [12841, "Coromandel Express", "MAIL_EXPRESS", 3, 17, ["SHM", "KGP", "BBS", "VSKP", "BZA", "GDR", "MAS"]],
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
  // 1) Zones + divisions for new sections (additive)
  const divisionByCode = {};
  for (const code of new Set(Object.values(SECTION_META).map((m) => m.division))) {
    const div = await prisma.division.findUnique({ where: { division_code: code } });
    if (!div) throw new Error(`Division ${code} missing`);
    divisionByCode[code] = div;
  }

  // 2) Sections
  const sectionByCode = {};
  for (const [code, meta] of Object.entries(SECTION_META)) {
    let section = await prisma.section.findFirst({ where: { section_code: code } });
    if (!section) {
      section = await prisma.section.create({
        data: {
          division_id: divisionByCode[meta.division].division_id,
          section_code: code,
          section_name: meta.name,
          start_chainage: meta.chain[0],
          end_chainage: meta.chain[1],
        },
      });
    }
    sectionByCode[code] = section;
  }
  console.log("Sections ready:", Object.keys(sectionByCode).length);

  // 3) Stations (reuse existing by code)
  const stationByCode = new Map((await prisma.station.findMany()).map((s) => [s.station_code, s]));
  const existingSectionCodes = new Map((await prisma.section.findMany()).map((s) => [s.section_code, s.section_id]));
  for (const [code, [name, lat, lng, section]] of Object.entries(NEW_STATIONS)) {
    if (stationByCode.has(code)) continue;
    const sectionId = existingSectionCodes.get(section);
    if (!sectionId) throw new Error(`Section ${section} missing for station ${code}`);
    const rec = await prisma.station.create({
      data: { section_id: sectionId, station_code: code, station_name: name, latitude: lat, longitude: lng },
    });
    stationByCode.set(code, rec);
  }
  console.log("Stations ready (existing + new):", stationByCode.size);

  // 4) Tracks + blocks per new section (2 blocks each)
  let trackSeq = 101;
  let blockSeq = 101;
  const firstBlockBySection = {};
  const trackByCode = {};
  const sectionCodes = Object.keys(SECTION_META);
  for (const code of sectionCodes) {
    const section = sectionByCode[code];
    let track = await prisma.track.findFirst({ where: { track_code: `TR-${trackSeq}` } });
    if (!track) {
      track = await prisma.track.create({
        data: { section_id: section.section_id, track_code: `TR-${trackSeq}`, track_name: `${SECTION_META[code].name} Line`, track_type: "MAIN", gauge: "BG", status: "ACTIVE" },
      });
    }
    trackByCode[track.track_code] = track;
    const [start, end] = SECTION_META[code].chain;
    const split = start + (end - start) / 2;
    const blockCodes = [];
    for (const [bs, be] of [[start, split], [split, end]]) {
      const codeB = `NB${blockSeq}`;
      blockSeq += 1;
      let block = await prisma.block.findFirst({ where: { block_code: codeB } });
      if (!block) {
        block = await prisma.block.create({
          data: { track_id: track.track_id, block_code: codeB, start_chainage: bs, end_chainage: be, status: "AVAILABLE", availability: true },
        });
      }
      blockCodes.push(block);
    }
    firstBlockBySection[code] = blockCodes[0];
    trackSeq += 1;
  }

  // Build first-block lookup for ALL sections (existing + new) so runs on
  // existing corridors (SEC-CNDP, SEC-BNMS, ...) also produce movements.
  const sections2 = await prisma.section.findMany({ include: { tracks: true } });
  for (const section of sections2) {
    if (!section.tracks.length) continue;
    const first = await prisma.block.findFirst({
      where: { track: { section_id: section.section_id } },
      orderBy: { start_chainage: "asc" },
    });
    if (first) firstBlockBySection[section.section_code] = first;
  }
  console.log("Tracks/Blocks ready:", trackSeq - 101, "tracks,", blockSeq - 101, "blocks");
  console.log("Section first-block map ready:", Object.keys(firstBlockBySection).length);

  // 5) Trains + routes + movements (times computed from real KM)
  const sectionIdToCode = new Map((await prisma.section.findMany()).map((s) => [s.section_id, s.section_code]));
  let trainCount = 0;
  let routeCount = 0;
  let moveCount = 0;
  for (const [number, name, type, priority, startH, routeCodes] of TRAINS) {
    let train = await prisma.train.findUnique({ where: { train_number: String(number) } });

    const stops = routeCodes.map((code) => stationByCode.get(code));
    const coords = stops.map((rec) => [Number(rec.latitude), Number(rec.longitude)]);

    // Schedule (arr/dep in hours from BASE)
    const departures = [startH];
    for (let i = 1; i < stops.length; i += 1) {
      const leg = distanceKm(coords[i - 1], coords[i]);
      const arrival = departures[i - 1] + leg / SPEED_KMPH;
      const isTerminal = i === stops.length - 1;
      departures.push(isTerminal ? arrival : arrival + DWELL_HOURS);
    }
    const arrivals = [null];
    for (let i = 1; i < stops.length; i += 1) {
      const leg = distanceKm(coords[i - 1], coords[i]);
      arrivals.push(departures[i - 1] + leg / SPEED_KMPH);
    }

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
      trainCount += 1;
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
        routeCount += 1;
      }
    }

    // Movements: one per contiguous section-run on the section's first block.
    // Recomputed each run so this seed stays idempotent.
    await prisma.trainBlockMovement.deleteMany({ where: { train_id: train.train_id } });
    const sectionOf = stops.map((rec) => rec.section_id);
    let runStart = 0;
    const usedBlocks = new Set();
    for (let i = 1; i <= stops.length; i += 1) {
      const boundary = i === stops.length || sectionOf[i] !== sectionOf[runStart];
      if (!boundary) continue;
      const lastInRun = i - 1;
      const sectionCode = sectionIdToCode.get(sectionOf[runStart]);
      const block = firstBlockBySection[sectionCode];
      const entryH = departures[runStart];
      const exitH = arrivals[lastInRun] ?? departures[lastInRun];
      const t0 = new Date(BASE.getTime() + entryH * 3600000);
      const t1 = new Date(BASE.getTime() + Math.max(entryH, exitH) * 3600000);
      if (block && t1 > t0 && !usedBlocks.has(block.block_id)) {
        await prisma.trainBlockMovement.create({
          data: { train_id: train.train_id, block_id: block.block_id, scheduled_entry: t0, scheduled_exit: t1 },
        });
        usedBlocks.add(block.block_id);
        moveCount += 1;
      }
      runStart = i;
    }

    const routeLen = await prisma.trainRoute.count({ where: { train_id: train.train_id } });
    console.log(`${train.train_number} ${train.train_name}: ${routeLen} stops`);
  }

  console.log(`\nDONE: ${trainCount} new trains, ${routeCount} new routes, ${moveCount} movement rows written`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());