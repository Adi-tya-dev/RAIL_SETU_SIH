const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const BASE = new Date("2026-09-15T00:00:00Z");

function hoursFromBase(h) {
  return new Date(BASE.getTime() + h * 60 * 60 * 1000);
}

async function main() {
  const existing = await prisma.zone.findUnique({ where: { zone_code: "NR" } });
  if (existing) {
    console.log("Seed data already exists. Skipping.");
    return;
  }

  console.log("Seeding RailSetu demo data...");

  // â”€â”€ Zones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const nr = await prisma.zone.create({ data: { zone_code: "NR", zone_name: "Northern Railway" } });
  const wr = await prisma.zone.create({ data: { zone_code: "WR", zone_name: "Western Railway" } });
  console.log("Zones created: NR, WR");

  // â”€â”€ Divisions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const dli = await prisma.division.create({ data: { zone_id: nr.zone_id, division_code: "DLI", division_name: "Delhi Division" } });
  const mz = await prisma.division.create({ data: { zone_id: nr.zone_id, division_code: "MZP", division_name: "Moradabad Division" } });
  const bct = await prisma.division.create({ data: { zone_id: wr.zone_id, division_code: "BCT", division_name: "Mumbai Central Division" } });
  console.log("Divisions created: DLI, MZP, BCT");

  // â”€â”€ Sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const secDljp = await prisma.section.create({ data: { division_id: dli.division_id, section_code: "SEC-DLJP", section_name: "Delhi-Jaipur Section", start_chainage: 0, end_chainage: 150 } });
  const secDlam = await prisma.section.create({ data: { division_id: dli.division_id, section_code: "SEC-DLAM", section_name: "Delhi-Ambala Section", start_chainage: 0, end_chainage: 200 } });
  const secMblk = await prisma.section.create({ data: { division_id: mz.division_id, section_code: "SEC-MBLK", section_name: "Moradabad-Lucknow Section", start_chainage: 0, end_chainage: 350 } });
  const secBcah = await prisma.section.create({ data: { division_id: bct.division_id, section_code: "SEC-BCAH", section_name: "Mumbai-Ahmedabad Section", start_chainage: 0, end_chainage: 500 } });
  const secBcpn = await prisma.section.create({ data: { division_id: bct.division_id, section_code: "SEC-BCPN", section_name: "Mumbai-Pune Section", start_chainage: 0, end_chainage: 150 } });
  console.log("Sections created: 5");

  // â”€â”€ Stations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ndls = await prisma.station.create({ data: { section_id: secDljp.section_id, station_code: "NDLS", station_name: "New Delhi", latitude: 28.6412, longitude: 77.2196 } });
  const dee = await prisma.station.create({ data: { section_id: secDljp.section_id, station_code: "DEE", station_name: "Delhi Sarai Rohilla", latitude: 28.6673, longitude: 77.2395 } });
  const dliStation = await prisma.station.create({ data: { section_id: secDlam.section_id, station_code: "DLI", station_name: "Old Delhi Junction", latitude: 28.6448, longitude: 77.2284 } });
  const bgz = await prisma.station.create({ data: { section_id: secDlam.section_id, station_code: "BGZ", station_name: "Bahadurgarh", latitude: 28.6700, longitude: 76.9300 } });
  const umb = await prisma.station.create({ data: { section_id: secDlam.section_id, station_code: "UMB", station_name: "Ambala Cantt Junction", latitude: 30.3200, longitude: 76.8600 } });
  const mb = await prisma.station.create({ data: { section_id: secMblk.section_id, station_code: "MB", station_name: "Moradabad Junction", latitude: 28.8420, longitude: 78.7630 } });
  const be = await prisma.station.create({ data: { section_id: secMblk.section_id, station_code: "BE", station_name: "Bareilly Junction", latitude: 28.3670, longitude: 79.4310 } });
  const lko = await prisma.station.create({ data: { section_id: secMblk.section_id, station_code: "LKO", station_name: "Lucknow Charbagh", latitude: 26.8526, longitude: 80.9230 } });
  const bctStation = await prisma.station.create({ data: { section_id: secBcah.section_id, station_code: "BCT", station_name: "Mumbai Central", latitude: 18.9690, longitude: 72.8147 } });
  const st = await prisma.station.create({ data: { section_id: secBcah.section_id, station_code: "ST", station_name: "Surat", latitude: 21.1700, longitude: 72.8310 } });
  const adi = await prisma.station.create({ data: { section_id: secBcah.section_id, station_code: "ADI", station_name: "Ahmedabad Junction", latitude: 23.0300, longitude: 72.5800 } });
  const pune = await prisma.station.create({ data: { section_id: secBcpn.section_id, station_code: "PUNE", station_name: "Pune Junction", latitude: 18.5284, longitude: 73.8741 } });
  console.log("Stations created: 12");

  // â”€â”€ Tracks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tr001 = await prisma.track.create({ data: { section_id: secDljp.section_id, track_code: "TR-001", track_name: "Delhi-Jaipur Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" } });
  const tr002 = await prisma.track.create({ data: { section_id: secDljp.section_id, track_code: "TR-002", track_name: "Delhi-Jaipur Loop Line", track_type: "LOOP", gauge: "BG", status: "ACTIVE" } });
  const tr003 = await prisma.track.create({ data: { section_id: secDlam.section_id, track_code: "TR-003", track_name: "Delhi-Ambala Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" } });
  const tr004 = await prisma.track.create({ data: { section_id: secMblk.section_id, track_code: "TR-004", track_name: "Moradabad-Lucknow Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" } });
  const tr005 = await prisma.track.create({ data: { section_id: secBcah.section_id, track_code: "TR-005", track_name: "Mumbai-Ahmedabad Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" } });
  const tr006 = await prisma.track.create({ data: { section_id: secBcpn.section_id, track_code: "TR-006", track_name: "Mumbai-Pune Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" } });
  console.log("Tracks created: 6");

  // â”€â”€ Blocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mkBlock = async (track, code, s, e, status, available) =>
    prisma.block.create({ data: { track_id: track.track_id, block_code: code, start_chainage: s, end_chainage: e, status, availability: available } });

  const b001 = await mkBlock(tr001, "B001", 0, 15, "AVAILABLE", true);
  const b002 = await mkBlock(tr001, "B002", 15, 30, "AVAILABLE", true);
  const b003 = await mkBlock(tr002, "B003", 0, 20, "AVAILABLE", true);
  const b004 = await mkBlock(tr003, "B004", 0, 20, "AVAILABLE", true);
  const b005 = await mkBlock(tr003, "B005", 20, 45, "AVAILABLE", true);
  const b006 = await mkBlock(tr003, "B006", 45, 70, "AVAILABLE", true);
  const b007 = await mkBlock(tr004, "B007", 0, 25, "AVAILABLE", true);
  const b008 = await mkBlock(tr004, "B008", 25, 55, "AVAILABLE", true);
  const b009 = await mkBlock(tr004, "B009", 55, 85, "AVAILABLE", true);
  const b010 = await mkBlock(tr005, "B010", 0, 30, "AVAILABLE", true);
  const b011 = await mkBlock(tr005, "B011", 30, 65, "AVAILABLE", true);
  const b012 = await mkBlock(tr005, "B012", 65, 100, "UNDER_REPAIR", false);
  const b013 = await mkBlock(tr006, "B013", 0, 20, "AVAILABLE", true);
  const b014 = await mkBlock(tr006, "B014", 20, 50, "AVAILABLE", true);
  const b015 = await mkBlock(tr006, "B015", 50, 80, "AVAILABLE", true);
  console.log("Blocks created: 15 (B012 UNDER_REPAIR)");

  // â”€â”€ Trains â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mkTrain = async (num, name, type, origin, dest, pri, status) =>
    prisma.train.create({ data: { train_number: num, train_name: name, train_type: type, origin_station_id: origin.station_id, destination_station_id: dest.station_id, priority: pri, status } });

  const t001 = await mkTrain("12301", "Howrah Rajdhani Express", "RAJDHANI", ndls, umb, 1, "ACTIVE");
  const t002 = await mkTrain("12951", "Mumbai Rajdhani", "RAJDHANI", bctStation, adi, 1, "ACTIVE");
  const t003 = await mkTrain("12002", "New Delhi Shatabdi", "SHATABDI", ndls, umb, 2, "ACTIVE");
  const t004 = await mkTrain("18237", "Chhattisgarh Express", "MAIL_EXPRESS", mb, lko, 3, "ACTIVE");
  const t005 = await mkTrain("14623", "Patalkot Express", "MAIL_EXPRESS", mb, be, 3, "ACTIVE");
  const t006 = await mkTrain("12472", "Swaraj Express", "SUPERFAST", ndls, dliStation, 2, "ACTIVE");
  const t007 = await mkTrain("12925", "Paschim Express", "MAIL_EXPRESS", ndls, bctStation, 3, "ACTIVE");
  const t008 = await mkTrain("19037", "Avadh Express", "MAIL_EXPRESS", be, lko, 4, "ACTIVE");
  const t009 = await mkTrain("54311", "Delhi-Rohtak Passenger", "PASSENGER", ndls, dee, 4, "ACTIVE");
  const t010 = await mkTrain("12903", "Golden Temple Mail", "MAIL_EXPRESS", bctStation, adi, 2, "ACTIVE");
  console.log("Trains created: 10");

  // â”€â”€ Train Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mkRoute = async (train, station, seq, arr, dep) =>
    prisma.trainRoute.create({ data: { train_id: train.train_id, station_id: station.station_id, sequence_number: seq, scheduled_arrival: arr ? hoursFromBase(arr) : null, scheduled_departure: dep ? hoursFromBase(dep) : null } });

  // T001: NDLS(9:00 dep) â†’ B001 area â†’ DEE(10:00) â†’ ... â†’ UMB(12:00)
  await mkRoute(t001, ndls, 1, null, 9);
  await mkRoute(t001, dee, 2, 9.5, 9.7);
  await mkRoute(t001, umb, 3, 12, null);

  // T009: NDLS(10:30 dep) â†’ DEE(11:15)
  await mkRoute(t009, ndls, 1, null, 10.5);
  await mkRoute(t009, dee, 2, 11.25, null);

  // T003: NDLS(8:00) â†’ BGZ(9:30) â†’ UMB(11:00)
  await mkRoute(t003, ndls, 1, null, 8);
  await mkRoute(t003, bgz, 2, 9.5, 9.7);
  await mkRoute(t003, umb, 3, 11, null);

  // T004: MB(7:00) â†’ BE(9:00) â†’ LKO(12:00)
  await mkRoute(t004, mb, 1, null, 7);
  await mkRoute(t004, be, 2, 9, 9.2);
  await mkRoute(t004, lko, 3, 12, null);

  // T005: MB(6:00) â†’ BE(8:00)
  await mkRoute(t005, mb, 1, null, 6);
  await mkRoute(t005, be, 2, 8, null);

  // T006: NDLS(14:00) â†’ DLI(14:45)
  await mkRoute(t006, ndls, 1, null, 14);
  await mkRoute(t006, dliStation, 2, 14.75, null);

  // T007: NDLS(16:00) â†’ ... â†’ BCT (next day, just origin for now)
  await mkRoute(t007, ndls, 1, null, 16);

  // T008: BE(13:00) â†’ LKO(16:00)
  await mkRoute(t008, be, 1, null, 13);
  await mkRoute(t008, lko, 2, 16, null);

  // T002: BCT(20:00) â†’ ST(23:00) â†’ ADI(2:00)
  await mkRoute(t002, bctStation, 1, null, 20);
  await mkRoute(t002, st, 2, 23, 23.2);
  await mkRoute(t002, adi, 3, 2, null);

  // T010: BCT(18:00) â†’ ST(21:00) â†’ ADI(0:00)
  await mkRoute(t010, bctStation, 1, null, 18);
  await mkRoute(t010, st, 2, 21, 21.2);
  await mkRoute(t010, adi, 3, 0, null);
  console.log("Train routes created");

  // â”€â”€ Train Block Movements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mkMove = async (train, block, entryH, exitH) =>
    prisma.trainBlockMovement.create({ data: { train_id: train.train_id, block_id: block.block_id, scheduled_entry: hoursFromBase(entryH), scheduled_exit: hoursFromBase(exitH) } });

  // T001 passes B001 at 11:00-11:15 (CONFLICT with B001 maintenance)
  await mkMove(t001, b001, 11.0, 11.25);
  // T001 passes B002 at 11:20-11:35
  await mkMove(t001, b002, 11.33, 11.58);

  // T009 passes B001 at 11:30-11:50 (CONFLICT with B001 maintenance)
  await mkMove(t009, b001, 11.5, 11.83);

  // T003 passes B004 at 9:00-9:15
  await mkMove(t003, b004, 9.0, 9.25);

  // T004 passes B007 at 7:30-7:50
  await mkMove(t004, b007, 7.5, 7.83);
  // T004 passes B008 at 8:30-9:00
  await mkMove(t004, b008, 8.5, 9.0);
  // T004 passes B009 at 10:30-11:00
  await mkMove(t004, b009, 10.5, 11.0);

  // T005 passes B007 at 6:30-6:50
  await mkMove(t005, b007, 6.5, 6.83);

  // T006 passes B004 at 14:10-14:20
  await mkMove(t006, b004, 14.17, 14.33);

  // T002 passes B010 at 20:30-20:50
  await mkMove(t002, b010, 20.5, 20.83);
  // T002 passes B011 at 21:00-21:30
  await mkMove(t002, b011, 21.0, 21.5);

  // T010 passes B010 at 18:30-18:50
  await mkMove(t010, b010, 18.5, 18.83);
  // T010 passes B011 at 19:00-19:30
  await mkMove(t010, b011, 19.0, 19.5);

  // T007 passes B013 at 16:15-16:30
  await mkMove(t007, b013, 16.25, 16.5);
  console.log("Train block movements created: 15");

  // â”€â”€ Assets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mkAsset = async (code, name, type, block, section, status, crit) =>
    prisma.asset.create({ data: { asset_code: code, asset_name: name, asset_type: type, block_id: block.block_id, section_id: section.section_id, status, criticality: crit } });

  // B001 assets (track + signalling + traction)
  const astTrack1 = await mkAsset("AST-001", "Track Panel B001-A", "TRACK_PANEL", b001, secDljp, "NEEDS_REPAIR", 4);
  const astOhe1 = await mkAsset("AST-002", "OHE Mast B001-KM5", "OVERHEAD_EQUIPMENT", b001, secDljp, "OPERATIONAL", 3);
  const astSignal1 = await mkAsset("AST-003", "Signal B001-S3", "SIGNAL", b001, secDljp, "OPERATIONAL", 4);

  // B004 assets
  const astTrack4 = await mkAsset("AST-004", "Track Panel B004-A", "TRACK_PANEL", b004, secDlam, "OPERATIONAL", 2);
  const astOhe4 = await mkAsset("AST-005", "OHE Mast B004-KM8", "OVERHEAD_EQUIPMENT", b004, secDlam, "OPERATIONAL", 2);

  // B007 assets
  const astTrack7 = await mkAsset("AST-006", "Track Panel B007-A", "TRACK_PANEL", b007, secMblk, "OPERATIONAL", 3);
  const astOhe7 = await mkAsset("AST-007", "OHE Mast B007-KM3", "OVERHEAD_EQUIPMENT", b007, secMblk, "NEEDS_INSPECTION", 3);

  // B010 assets
  const astTrack10 = await mkAsset("AST-008", "Track Panel B010-A", "TRACK_PANEL", b010, secBcah, "OPERATIONAL", 2);
  const astSignal10 = await mkAsset("AST-009", "Signal B010-S1", "SIGNAL", b010, secBcah, "DEFECTIVE", 4);

  // B012 assets (unavailable block)
  const astTrack12 = await mkAsset("AST-010", "Track Panel B012-A", "TRACK_PANEL", b012, secBcah, "UNDER_REPAIR", 4);
  const astOhe12 = await mkAsset("AST-011", "OHE Mast B012-KM2", "OVERHEAD_EQUIPMENT", b012, secBcah, "UNDER_REPAIR", 3);

  // B002 asset
  const astTrack2 = await mkAsset("AST-012", "Track Panel B002-A", "TRACK_PANEL", b002, secDljp, "OPERATIONAL", 1);

  // B008 asset
  const astSignal8 = await mkAsset("AST-013", "Signal B008-S2", "SIGNAL", b008, secMblk, "OPERATIONAL", 2);

  // B013 asset
  const astTrack13 = await mkAsset("AST-014", "Track Panel B013-A", "TRACK_PANEL", b013, secBcpn, "OPERATIONAL", 2);

  // B014 asset
  const astOhe14 = await mkAsset("AST-015", "OHE Mast B014-KM1", "OVERHEAD_EQUIPMENT", b014, secBcpn, "OPERATIONAL", 1);
  console.log("Assets created: 15");

  // â”€â”€ Maintenance Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mkTask = async (data) => prisma.maintenanceTask.create({ data });

  // === MEGA BLOCK CANDIDATE on B001 (3 tasks, overlapping windows) ===
  const mt001 = await mkTask({
    asset_id: astTrack1.asset_id, block_id: b001.block_id, section_id: secDljp.section_id,
    department: "ENGINEERING", maintenance_type: "Track Realignment",
    description: "Panel B001-A buckled due to thermal stress. Requires realignment of 150m section.",
    priority: 4, criticality: 4, urgency: 4, duration_minutes: 120,
    preferred_start: hoursFromBase(10), deadline: hoursFromBase(14), status: "PENDING",
  });

  const mt002 = await mkTask({
    asset_id: astOhe1.asset_id, block_id: b001.block_id, section_id: secDljp.section_id,
    department: "TRACTION", maintenance_type: "OHE Wire Replacement",
    description: "Overhead equipment wire sag detected near B001-KM5. Wire replacement required.",
    priority: 3, criticality: 3, urgency: 3, duration_minutes: 90,
    preferred_start: hoursFromBase(10.5), deadline: hoursFromBase(14), status: "PENDING",
  });

  const mt003 = await mkTask({
    asset_id: astSignal1.asset_id, block_id: b001.block_id, section_id: secDljp.section_id,
    department: "SIGNAL", maintenance_type: "Signal Calibration",
    description: "Signal B001-S3 showing intermittent aspects. Calibration and lens cleaning required.",
    priority: 3, criticality: 4, urgency: 3, duration_minutes: 60,
    preferred_start: hoursFromBase(10), deadline: hoursFromBase(13), status: "PENDING",
  });

  // === B004 â€” routine low-priority inspection ===
  const mt004 = await mkTask({
    asset_id: astTrack4.asset_id, block_id: b004.block_id, section_id: secDlam.section_id,
    department: "ENGINEERING", maintenance_type: "Routine Track Inspection",
    description: "Scheduled quarterly inspection of track geometry and fastening systems.",
    priority: 1, criticality: 1, urgency: 1, duration_minutes: 180,
    preferred_start: hoursFromBase(6), deadline: null, status: "PENDING",
  });

  // === B004 â€” Traction inspection (not compatible with MT004: same block, different dept) ===
  const mt005 = await mkTask({
    asset_id: astOhe4.asset_id, block_id: b004.block_id, section_id: secDlam.section_id,
    department: "TRACTION", maintenance_type: "OHE Annual Inspection",
    description: "Annual inspection of overhead equipment on Delhi-Ambala main line section.",
    priority: 2, criticality: 2, urgency: 2, duration_minutes: 120,
    preferred_start: hoursFromBase(6.5), deadline: null, status: "PENDING",
  });

  // === B007 â€” deadline-sensitive traction task ===
  const mt006 = await mkTask({
    asset_id: astOhe7.asset_id, block_id: b007.block_id, section_id: secMblk.section_id,
    department: "TRACTION", maintenance_type: "OHE Tensioning Correction",
    description: "OHE tensioning out of spec. Deadline: regulation inspection in 2 days.",
    priority: 4, criticality: 3, urgency: 4, duration_minutes: 60,
    preferred_start: hoursFromBase(20), deadline: hoursFromBase(48), status: "PENDING",
  });

  // === B010 â€” high-criticality signalling ===
  const mt007 = await mkTask({
    asset_id: astSignal10.asset_id, block_id: b010.block_id, section_id: secBcah.section_id,
    department: "SIGNAL", maintenance_type: "Signal Aspect Replacement",
    description: "Signal B010-S1 red aspect failure. Immediate replacement of LED module required.",
    priority: 4, criticality: 4, urgency: 4, duration_minutes: 45,
    preferred_start: hoursFromBase(14), deadline: hoursFromBase(16), status: "PENDING",
  });

  // === B012 â€” maintenance on unavailable block (long-term repair) ===
  const mt008 = await mkTask({
    asset_id: astTrack12.asset_id, block_id: b012.block_id, section_id: secBcah.section_id,
    department: "ENGINEERING", maintenance_type: "Major Track Renewal",
    description: "Complete track renewal on B012. Ballast, sleeper and rail replacement.",
    priority: 3, criticality: 4, urgency: 2, duration_minutes: 480,
    preferred_start: hoursFromBase(0), deadline: hoursFromBase(72), status: "IN_PROGRESS",
  });

  // === B008 â€” routine signalling ===
  const mt009 = await mkTask({
    asset_id: astSignal8.asset_id, block_id: b008.block_id, section_id: secMblk.section_id,
    department: "SIGNAL", maintenance_type: "Level Crossing Alarm Test",
    description: "Periodic testing of level crossing warning systems at B008-LC3.",
    priority: 2, criticality: 2, urgency: 2, duration_minutes: 30,
    preferred_start: hoursFromBase(14), deadline: null, status: "PENDING",
  });

  // === B013 â€” routine track work ===
  const mt010 = await mkTask({
    asset_id: astTrack13.asset_id, block_id: b013.block_id, section_id: secBcpn.section_id,
    department: "ENGINEERING", maintenance_type: "Sleeper Replacement",
    description: "Replace 50 deteriorated concrete sleepers on B013.",
    priority: 2, criticality: 2, urgency: 1, duration_minutes: 240,
    preferred_start: hoursFromBase(22), deadline: null, status: "PENDING",
  });

  // === B014 â€” OHE minor repair ===
  const mt011 = await mkTask({
    asset_id: astOhe14.asset_id, block_id: b014.block_id, section_id: secBcpn.section_id,
    department: "TRACTION", maintenance_type: "Dropper Replacement",
    description: "Replace 5 droppers on B014 OHE span.",
    priority: 1, criticality: 1, urgency: 1, duration_minutes: 45,
    preferred_start: hoursFromBase(22), deadline: null, status: "PENDING",
  });

  // === Additional tasks for variety ===
  const mt012 = await mkTask({
    asset_id: astTrack2.asset_id, block_id: b002.block_id, section_id: secDljp.section_id,
    department: "ENGINEERING", maintenance_type: "Ballast Cleaning",
    description: "Mechanical ballast cleaning on B002 curve section.",
    priority: 2, criticality: 2, urgency: 2, duration_minutes: 150,
    preferred_start: hoursFromBase(20), deadline: null, status: "PENDING",
  });

  const mt013 = await mkTask({
    asset_id: astOhe7.asset_id, block_id: b007.block_id, section_id: secMblk.section_id,
    department: "ENGINEERING", maintenance_type: "Fencing Repair",
    description: "Boundary fencing damaged near B007-KM3. Repair 200m stretch.",
    priority: 1, criticality: 1, urgency: 1, duration_minutes: 90,
    preferred_start: hoursFromBase(8), deadline: null, status: "COMPLETED",
  });

  const mt014 = await mkTask({
    asset_id: astTrack7.asset_id, block_id: b007.block_id, section_id: secMblk.section_id,
    department: "SIGNAL", maintenance_type: "Telecom Cable Jointing",
    description: "Joint replacement in telecom cable along B007.",
    priority: 2, criticality: 3, urgency: 2, duration_minutes: 60,
    preferred_start: hoursFromBase(15), deadline: hoursFromBase(40), status: "PENDING",
  });

  const mt015 = await mkTask({
    asset_id: astTrack1.asset_id, block_id: b001.block_id, section_id: secDljp.section_id,
    department: "ENGINEERING", maintenance_type: "Rail Grinding",
    description: "Corrective rail grinding on B001 to address corrugation.",
    priority: 3, criticality: 2, urgency: 2, duration_minutes: 90,
    preferred_start: hoursFromBase(22), deadline: null, status: "PENDING",
  });

  const mt016 = await mkTask({
    asset_id: astTrack10.asset_id, block_id: b010.block_id, section_id: secBcah.section_id,
    department: "TRACTION", maintenance_type: "Feeder Cable Replacement",
    description: "Traction feeder cable showing insulation degradation.",
    priority: 3, criticality: 3, urgency: 3, duration_minutes: 75,
    preferred_start: hoursFromBase(14.5), deadline: hoursFromBase(18), status: "PENDING",
  });

  const mt017 = await mkTask({
    asset_id: astTrack4.asset_id, block_id: null, section_id: secDlam.section_id,
    department: "ENGINEERING", maintenance_type: "Culvert Cleaning",
    description: "Monsoon preparation: cleaning culverts along Delhi-Ambala section.",
    priority: 2, criticality: 2, urgency: 3, duration_minutes: 120,
    preferred_start: hoursFromBase(6), deadline: hoursFromBase(24), status: "PENDING",
  });

  const mt018 = await mkTask({
    asset_id: astOhe1.asset_id, block_id: b001.block_id, section_id: secDljp.section_id,
    department: "SIGNAL", maintenance_type: "UPS Battery Replacement",
    description: "Replace signal house UPS batteries at B001 control point.",
    priority: 2, criticality: 3, urgency: 2, duration_minutes: 30,
    preferred_start: hoursFromBase(15), deadline: null, status: "PENDING",
  });

  const mt019 = await mkTask({
    asset_id: astOhe12.asset_id, block_id: b012.block_id, section_id: secBcah.section_id,
    department: "TRACTION", maintenance_type: "Traction Substation Inspection",
    description: "Routine inspection of traction substation equipment near B012.",
    priority: 1, criticality: 2, urgency: 1, duration_minutes: 60,
    preferred_start: hoursFromBase(10), deadline: null, status: "PENDING",
  });

  const mt020 = await mkTask({
    asset_id: astTrack13.asset_id, block_id: b013.block_id, section_id: secBcpn.section_id,
    department: "SIGNAL", maintenance_type: "Axle Counter Calibration",
    description: "Calibrate axle counter heads at B013 block section marker.",
    priority: 3, criticality: 3, urgency: 3, duration_minutes: 40,
    preferred_start: hoursFromBase(16), deadline: hoursFromBase(20), status: "PENDING",
  });
  console.log("Maintenance tasks created: 20 (including 3 Mega Block candidates on B001)");

  // â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const counts = {
    zones: await prisma.zone.count(),
    divisions: await prisma.division.count(),
    sections: await prisma.section.count(),
    stations: await prisma.station.count(),
    tracks: await prisma.track.count(),
    blocks: await prisma.block.count(),
    trains: await prisma.train.count(),
    trainRoutes: await prisma.trainRoute.count(),
    trainBlockMovements: await prisma.trainBlockMovement.count(),
    assets: await prisma.asset.count(),
    maintenanceTasks: await prisma.maintenanceTask.count(),
  };
  console.log("Seed complete. Counts:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });