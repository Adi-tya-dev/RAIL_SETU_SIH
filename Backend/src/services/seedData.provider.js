/**
 * Complete In-Memory Seed Data Provider for RailSetu
 * Mirrors the complete 43-train dataset across:
 * - prisma/seed.js (10 trains)
 * - prisma/seed-longdistance.js (20 trains)
 * - prisma/seed-sanghamitra.js (1 major corridor train)
 * - prisma/seed-priority.js (12 priority & suburban trains)
 * Total: 43 Trains, 50+ Stations, 19 Sections, 24 Blocks, 15 Assets, 20 Maintenance Tasks.
 */

const BASE = new Date("2026-09-18T00:00:00Z");

function hoursFromBase(h) {
  return new Date(BASE.getTime() + h * 60 * 60 * 1000);
}

function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ── 1. Zones ─────────────────────────────────────────────────────────────
const zones = [
  { zone_id: 1, zone_code: "NR", zone_name: "Northern Railway" },
  { zone_id: 2, zone_code: "WR", zone_name: "Western Railway" },
  { zone_id: 3, zone_code: "ECR", zone_name: "East Central Railway" },
  { zone_id: 4, zone_code: "SR", zone_name: "Southern Railway" },
  { zone_id: 5, zone_code: "CR", zone_name: "Central Railway" },
];

// ── 2. Divisions ─────────────────────────────────────────────────────────
const divisions = [
  { division_id: 1, zone_id: 1, division_code: "DLI", division_name: "Delhi Division" },
  { division_id: 2, zone_id: 1, division_code: "MZP", division_name: "Moradabad Division" },
  { division_id: 3, zone_id: 2, division_code: "BCT", division_name: "Mumbai Central Division" },
  { division_id: 4, zone_id: 3, division_code: "DNR", division_name: "Danapur Division" },
  { division_id: 5, zone_id: 4, division_code: "BEN", division_name: "Bengaluru Division" },
];

// ── 3. Sections ──────────────────────────────────────────────────────────
const sections = [
  { section_id: 1, division_id: 1, section_code: "SEC-DLJP", section_name: "Delhi-Jaipur Section", start_chainage: 0, end_chainage: 150 },
  { section_id: 2, division_id: 1, section_code: "SEC-DLAM", section_name: "Delhi-Ambala Section", start_chainage: 0, end_chainage: 200 },
  { section_id: 3, division_id: 2, section_code: "SEC-MBLK", section_name: "Moradabad-Lucknow Section", start_chainage: 0, end_chainage: 350 },
  { section_id: 4, division_id: 3, section_code: "SEC-BCAH", section_name: "Mumbai-Ahmedabad Section", start_chainage: 0, end_chainage: 500 },
  { section_id: 5, division_id: 3, section_code: "SEC-BCPN", section_name: "Mumbai-Pune Section", start_chainage: 0, end_chainage: 150 },
  { section_id: 6, division_id: 1, section_code: "SEC-CTRDL", section_name: "Mumbai-Delhi Main Corridor", start_chainage: 0, end_chainage: 2000 },
  { section_id: 7, division_id: 4, section_code: "SEC-ECLN", section_name: "East Coast Main Corridor", start_chainage: 0, end_chainage: 2500 },
  { section_id: 8, division_id: 4, section_code: "SEC-GRDCH", section_name: "Grand Chord (Howrah-Delhi)", start_chainage: 0, end_chainage: 1200 },
  { section_id: 9, division_id: 2, section_code: "SEC-EWCN", section_name: "East-West Central Corridor", start_chainage: 0, end_chainage: 1500 },
  { section_id: 10, division_id: 2, section_code: "SEC-UPER", section_name: "Eastern UP-Gorakhpur", start_chainage: 0, end_chainage: 900 },
  { section_id: 11, division_id: 4, section_code: "SEC-NEFR", section_name: "Northeast Frontier Corridor", start_chainage: 0, end_chainage: 1100 },
  { section_id: 12, division_id: 3, section_code: "SEC-WRML", section_name: "Western Main Corridor", start_chainage: 0, end_chainage: 2100 },
  { section_id: 13, division_id: 1, section_code: "SEC-RJWNDL", section_name: "Jaipur-Delhi Line", start_chainage: 0, end_chainage: 800 },
  { section_id: 14, division_id: 1, section_code: "SEC-DLNORTH", section_name: "Delhi-North Line", start_chainage: 0, end_chainage: 900 },
  { section_id: 15, division_id: 5, section_code: "SEC-GTLSR", section_name: "Guntakal-Solapur-Pune", start_chainage: 0, end_chainage: 1000 },
  { section_id: 16, division_id: 2, section_code: "SEC-HYDNGP", section_name: "Hyderabad-Nagpur", start_chainage: 0, end_chainage: 800 },
  { section_id: 17, division_id: 5, section_code: "SEC-SBCKD", section_name: "Bengaluru-Katpadi-Chennai", start_chainage: 0, end_chainage: 500 },
  { section_id: 18, division_id: 5, section_code: "SEC-SWRLN", section_name: "Southern West Coast", start_chainage: 0, end_chainage: 1900 },
  { section_id: 19, division_id: 3, section_code: "SEC-MUMTN", section_name: "Mumbai Terminals", start_chainage: 0, end_chainage: 600 },
  { section_id: 20, division_id: 5, section_code: "SEC-BNMS", section_name: "Bengaluru-Chennai Corridor", start_chainage: 0, end_chainage: 360 },
  { section_id: 21, division_id: 4, section_code: "SEC-CNDP", section_name: "Chennai-Danapur Corridor", start_chainage: 0, end_chainage: 2100 },
];

const sectionMap = new Map(sections.map((s) => [s.section_code, s]));
const sectionIdMap = new Map(sections.map((s) => [s.section_id, s]));

// ── 4. Stations ──────────────────────────────────────────────────────────
const rawStationData = [
  // Delhi & NCR
  { id: 1, code: "NDLS", name: "New Delhi", lat: 28.6412, lng: 77.2196, sec: "SEC-DLJP" },
  { id: 2, code: "DEE", name: "Delhi Sarai Rohilla", lat: 28.6673, lng: 77.2395, sec: "SEC-DLJP" },
  { id: 3, code: "DLI", name: "Old Delhi Junction", lat: 28.6448, lng: 77.2284, sec: "SEC-DLAM" },
  { id: 4, code: "BGZ", name: "Bahadurgarh", lat: 28.67, lng: 76.93, sec: "SEC-DLAM" },
  { id: 5, code: "UMB", name: "Ambala Cantt Junction", lat: 30.32, lng: 76.86, sec: "SEC-DLAM" },
  // UP & North
  { id: 6, code: "MB", name: "Moradabad Junction", lat: 28.842, lng: 78.763, sec: "SEC-MBLK" },
  { id: 7, code: "BE", name: "Bareilly Junction", lat: 28.367, lng: 79.431, sec: "SEC-MBLK" },
  { id: 8, code: "LKO", name: "Lucknow Charbagh", lat: 26.8526, lng: 80.923, sec: "SEC-MBLK" },
  { id: 13, code: "CNB", name: "Kanpur Central", lat: 26.4499, lng: 80.3319, sec: "SEC-CTRDL" },
  { id: 17, code: "GWL", name: "Gwalior Junction", lat: 26.2124, lng: 78.1772, sec: "SEC-CTRDL" },
  { id: 18, code: "AGC", name: "Agra Cantt", lat: 27.1767, lng: 78.0081, sec: "SEC-CTRDL" },
  { id: 34, code: "GKP", name: "Gorakhpur Junction", lat: 26.7606, lng: 83.3732, sec: "SEC-UPER" },
  { id: 70, code: "DDU", name: "Pt. Deen Dayal Upadhyaya", lat: 25.283, lng: 82.603, sec: "SEC-GRDCH" },
  { id: 76, code: "PRYJ", name: "Prayagraj Junction", lat: 25.446, lng: 81.849, sec: "SEC-GRDCH" },
  { id: 88, code: "MKP", name: "Manikpur", lat: 25.059, lng: 81.115, sec: "SEC-CNDP" },
  { id: 89, code: "DNR", name: "Danapur", lat: 25.605, lng: 85.027, sec: "SEC-CNDP" },
  // Punjab & Jammu
  { id: 50, code: "LDH", name: "Ludhiana Junction", lat: 30.909, lng: 75.854, sec: "SEC-DLNORTH" },
  { id: 51, code: "JAT", name: "Jammu Tawi", lat: 32.7266, lng: 74.857, sec: "SEC-DLNORTH" },
  { id: 52, code: "FZR", name: "Ferozpur Cantt", lat: 30.9227, lng: 74.795, sec: "SEC-DLNORTH" },
  { id: 53, code: "ASR", name: "Amritsar Junction", lat: 31.633, lng: 74.873, sec: "SEC-DLNORTH" },
  // Mumbai & West
  { id: 9, code: "BCT", name: "Mumbai Central", lat: 18.969, lng: 72.8147, sec: "SEC-BCAH" },
  { id: 10, code: "ST", name: "Surat", lat: 21.17, lng: 72.831, sec: "SEC-BCAH" },
  { id: 11, code: "ADI", name: "Ahmedabad Junction", lat: 23.03, lng: 72.58, sec: "SEC-BCAH" },
  { id: 12, code: "PUNE", name: "Pune Junction", lat: 18.5284, lng: 73.8741, sec: "SEC-BCPN" },
  { id: 14, code: "BSL", name: "Bhusaval Junction", lat: 21.0409, lng: 76.7637, sec: "SEC-CTRDL" },
  { id: 15, code: "ET", name: "Itarsi Junction", lat: 22.6119, lng: 77.7689, sec: "SEC-CTRDL" },
  { id: 16, code: "BPL", name: "Bhopal Junction", lat: 23.2596, lng: 77.4126, sec: "SEC-CTRDL" },
  { id: 41, code: "BRC", name: "Vadodara Junction", lat: 22.31, lng: 73.186, sec: "SEC-WRML" },
  { id: 42, code: "RTM", name: "Ratlam Junction", lat: 23.5276, lng: 75.4362, sec: "SEC-WRML" },
  { id: 43, code: "RJT", name: "Rajkot Junction", lat: 22.3094, lng: 70.8021, sec: "SEC-WRML" },
  { id: 44, code: "PBR", name: "Porbandar", lat: 21.6438, lng: 69.6318, sec: "SEC-WRML" },
  { id: 45, code: "GIMB", name: "Gandhidham Junction", lat: 23.0833, lng: 70.1333, sec: "SEC-WRML" },
  { id: 46, code: "ABR", name: "Abu Road", lat: 24.8932, lng: 74.6224, sec: "SEC-WRML" },
  { id: 47, code: "JP", name: "Jaipur Junction", lat: 26.92, lng: 75.808, sec: "SEC-RJWNDL" },
  { id: 48, code: "SWM", name: "Sawai Madhopur Junction", lat: 25.963, lng: 76.34, sec: "SEC-RJWNDL" },
  { id: 49, code: "BGKT", name: "Bhagat Ki Kothi (Jodhpur)", lat: 26.2912, lng: 73.0165, sec: "SEC-RJWNDL" },
  { id: 66, code: "LTT", name: "Lokmanya Tilak Terminus", lat: 19.068, lng: 72.836, sec: "SEC-MUMTN" },
  { id: 67, code: "PNVL", name: "Panvel Junction", lat: 18.993, lng: 73.099, sec: "SEC-MUMTN" },
  { id: 68, code: "CSMT", name: "Mumbai CSMT", lat: 18.9398, lng: 72.8355, sec: "SEC-MUMTN" },
  // East & Kolkata
  { id: 19, code: "HWH", name: "Howrah Junction", lat: 22.5833, lng: 88.337, sec: "SEC-ECLN" },
  { id: 20, code: "SHM", name: "Shalimar", lat: 22.541, lng: 88.297, sec: "SEC-ECLN" },
  { id: 21, code: "BLS", name: "Balasore", lat: 21.5137, lng: 86.9316, sec: "SEC-ECLN" },
  { id: 22, code: "BBS", name: "Bhubaneswar", lat: 20.2961, lng: 85.8245, sec: "SEC-ECLN" },
  { id: 23, code: "CTC", name: "Cuttack Junction", lat: 20.27, lng: 85.8333, sec: "SEC-ECLN" },
  { id: 24, code: "VSKP", name: "Visakhapatnam Junction", lat: 17.7233, lng: 83.305, sec: "SEC-ECLN" },
  { id: 25, code: "VZM", name: "Vizianagaram Junction", lat: 18.1174, lng: 83.4241, sec: "SEC-ECLN" },
  { id: 26, code: "PURI", name: "Puri", lat: 19.813, lng: 85.828, sec: "SEC-ECLN" },
  { id: 27, code: "DGR", name: "Durgapur", lat: 23.7046, lng: 87.017, sec: "SEC-GRDCH" },
  { id: 28, code: "GAYA", name: "Gaya Junction", lat: 24.79, lng: 84.999, sec: "SEC-GRDCH" },
  { id: 29, code: "KGP", name: "Kharagpur Junction", lat: 22.331, lng: 87.3075, sec: "SEC-EWCN" },
  { id: 30, code: "TATA", name: "Tatanagar Junction", lat: 22.7718, lng: 86.2053, sec: "SEC-EWCN" },
  { id: 31, code: "ROU", name: "Rourkela", lat: 22.2417, lng: 84.8883, sec: "SEC-EWCN" },
  { id: 32, code: "JSG", name: "Jharsuguda Junction", lat: 21.856, lng: 84.026, sec: "SEC-EWCN" },
  { id: 33, code: "GMO", name: "Netaji SC Bose Gomoh", lat: 23.83, lng: 86.09, sec: "SEC-EWCN" },
  { id: 73, code: "JBP", name: "Jabalpur Junction", lat: 23.168, lng: 79.948, sec: "SEC-CTRDL" },
  { id: 87, code: "KTE", name: "Katni Junction", lat: 23.791, lng: 80.392, sec: "SEC-CNDP" },
  // Northeast
  { id: 35, code: "KIR", name: "Katihar Junction", lat: 25.5453, lng: 87.5748, sec: "SEC-UPER" },
  { id: 36, code: "NJP", name: "New Jalpaiguri", lat: 26.7239, lng: 88.484, sec: "SEC-NEFR" },
  { id: 37, code: "NBQ", name: "New Bongaigaon", lat: 26.3226, lng: 90.236, sec: "SEC-NEFR" },
  { id: 38, code: "GHY", name: "Guwahati", lat: 26.183, lng: 91.751, sec: "SEC-NEFR" },
  { id: 39, code: "LMG", name: "Lumding Junction", lat: 25.7473, lng: 93.17, sec: "SEC-NEFR" },
  { id: 40, code: "DBRG", name: "Dibrugarh", lat: 27.4727, lng: 94.9121, sec: "SEC-NEFR" },
  // South & Central
  { id: 54, code: "GTL", name: "Guntakal Junction", lat: 15.1682, lng: 77.3834, sec: "SEC-GTLSR" },
  { id: 55, code: "SUR", name: "Solapur Junction", lat: 17.6619, lng: 75.9101, sec: "SEC-GTLSR" },
  { id: 56, code: "HYB", name: "Secunderabad Junction", lat: 17.408, lng: 78.458, sec: "SEC-HYDNGP" },
  { id: 57, code: "KZJ", name: "Kazipet Junction", lat: 17.385, lng: 78.4867, sec: "SEC-HYDNGP" },
  { id: 58, code: "SBC", name: "KSR Bengaluru City", lat: 12.9784, lng: 77.5707, sec: "SEC-SBCKD" },
  { id: 59, code: "KPD", name: "Katpadi Junction", lat: 12.9749, lng: 79.1705, sec: "SEC-SBCKD" },
  { id: 60, code: "GDR", name: "Gudur Junction", lat: 14.0107, lng: 79.8472, sec: "SEC-CNDP" },
  { id: 61, code: "TVC", name: "Thiruvananthapuram Central", lat: 8.4844, lng: 76.9405, sec: "SEC-SWRLN" },
  { id: 62, code: "QLN", name: "Kollam Junction", lat: 8.8804, lng: 76.6027, sec: "SEC-SWRLN" },
  { id: 63, code: "ERS", name: "Ernakulam Junction", lat: 9.9704, lng: 76.2876, sec: "SEC-SWRLN" },
  { id: 64, code: "CLT", name: "Kozhikode", lat: 11.2588, lng: 75.7784, sec: "SEC-SWRLN" },
  { id: 65, code: "MAO", name: "Madgaon Junction", lat: 15.3981, lng: 73.8162, sec: "SEC-SWRLN" },
  { id: 69, code: "MAS", name: "Chennai Central", lat: 13.0827, lng: 80.2707, sec: "SEC-SBCKD" },
  { id: 71, code: "BZA", name: "Vijayawada Junction", lat: 16.518, lng: 80.62, sec: "SEC-ECLN" },
  { id: 72, code: "NGP", name: "Nagpur Junction", lat: 21.15, lng: 79.088, sec: "SEC-CTRDL" },
  { id: 74, code: "KJM", name: "Krishnarajapuram", lat: 12.998, lng: 77.689, sec: "SEC-SBCKD" },
  { id: 75, code: "NLR", name: "Nellore", lat: 14.442, lng: 79.986, sec: "SEC-ECLN" },
  { id: 77, code: "SMVB", name: "SMVT Bengaluru", lat: 12.9791, lng: 77.5904, sec: "SEC-BNMS" },
  { id: 78, code: "BWT", name: "Bangarapet", lat: 12.986, lng: 78.144, sec: "SEC-BNMS" },
  { id: 79, code: "JTJ", name: "Jolarpettai Junction", lat: 12.567, lng: 78.581, sec: "SEC-BNMS" },
  { id: 80, code: "SA", name: "Salem Junction", lat: 11.654, lng: 78.144, sec: "SEC-BNMS" },
  { id: 81, code: "ED", name: "Erode Junction", lat: 11.341, lng: 77.728, sec: "SEC-BNMS" },
  { id: 82, code: "TPJ", name: "Tiruchirappalli", lat: 10.796, lng: 78.688, sec: "SEC-BNMS" },
  { id: 83, code: "TPTY", name: "Tirupati", lat: 13.627, lng: 79.41, sec: "SEC-BNMS" },
  { id: 84, code: "KMM", name: "Khammam", lat: 17.251, lng: 80.156, sec: "SEC-CNDP" },
  { id: 85, code: "WL", name: "Warangal", lat: 17.968, lng: 79.606, sec: "SEC-CNDP" },
  { id: 86, code: "BPQ", name: "Balharshah", lat: 19.857, lng: 79.367, sec: "SEC-CNDP" },
];

const stations = rawStationData.map((s) => ({
  station_id: s.id,
  station_code: s.code,
  station_name: s.name,
  latitude: s.lat,
  longitude: s.lng,
  section_id: sectionMap.get(s.sec)?.section_id || 1,
}));

const stationCodeMap = new Map(stations.map((st) => [st.station_code, st]));
const stationIdMap = new Map(stations.map((st) => [st.station_id, st]));

// ── 5. Tracks ────────────────────────────────────────────────────────────
const tracks = [
  { track_id: 1, section_id: 1, track_code: "TR-001", track_name: "Delhi-Jaipur Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" },
  { track_id: 2, section_id: 1, track_code: "TR-002", track_name: "Delhi-Jaipur Loop Line", track_type: "LOOP", gauge: "BG", status: "ACTIVE" },
  { track_id: 3, section_id: 2, track_code: "TR-003", track_name: "Delhi-Ambala Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" },
  { track_id: 4, section_id: 3, track_code: "TR-004", track_name: "Moradabad-Lucknow Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" },
  { track_id: 5, section_id: 4, track_code: "TR-005", track_name: "Mumbai-Ahmedabad Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" },
  { track_id: 6, section_id: 5, track_code: "TR-006", track_name: "Mumbai-Pune Main Line", track_type: "MAIN", gauge: "BG", status: "ACTIVE" },
  { track_id: 7, section_id: 20, track_code: "TR-007", track_name: "Bengaluru-Chennai Corridor", track_type: "MAIN", gauge: "BG", status: "ACTIVE" },
  { track_id: 8, section_id: 21, track_code: "TR-008", track_name: "Chennai-Danapur Corridor", track_type: "MAIN", gauge: "BG", status: "ACTIVE" },
];

const trackMap = new Map(tracks.map((t) => [t.track_id, { ...t, section: sectionIdMap.get(t.section_id) }]));

// ── 6. Blocks ────────────────────────────────────────────────────────────
const rawBlocks = [
  { block_id: 1, track_id: 1, block_code: "B001", start_chainage: 0, end_chainage: 15, status: "AVAILABLE", availability: true },
  { block_id: 2, track_id: 1, block_code: "B002", start_chainage: 15, end_chainage: 30, status: "AVAILABLE", availability: true },
  { block_id: 3, track_id: 2, block_code: "B003", start_chainage: 0, end_chainage: 20, status: "AVAILABLE", availability: true },
  { block_id: 4, track_id: 3, block_code: "B004", start_chainage: 0, end_chainage: 20, status: "AVAILABLE", availability: true },
  { block_id: 5, track_id: 3, block_code: "B005", start_chainage: 20, end_chainage: 45, status: "AVAILABLE", availability: true },
  { block_id: 6, track_id: 3, block_code: "B006", start_chainage: 45, end_chainage: 70, status: "AVAILABLE", availability: true },
  { block_id: 7, track_id: 4, block_code: "B007", start_chainage: 0, end_chainage: 25, status: "AVAILABLE", availability: true },
  { block_id: 8, track_id: 4, block_code: "B008", start_chainage: 25, end_chainage: 55, status: "AVAILABLE", availability: true },
  { block_id: 9, track_id: 4, block_code: "B009", start_chainage: 55, end_chainage: 85, status: "AVAILABLE", availability: true },
  { block_id: 10, track_id: 5, block_code: "B010", start_chainage: 0, end_chainage: 30, status: "AVAILABLE", availability: true },
  { block_id: 11, track_id: 5, block_code: "B011", start_chainage: 30, end_chainage: 65, status: "AVAILABLE", availability: true },
  { block_id: 12, track_id: 5, block_code: "B012", start_chainage: 65, end_chainage: 100, status: "UNDER_REPAIR", availability: false },
  { block_id: 13, track_id: 6, block_code: "B013", start_chainage: 0, end_chainage: 20, status: "AVAILABLE", availability: true },
  { block_id: 14, track_id: 6, block_code: "B014", start_chainage: 20, end_chainage: 50, status: "AVAILABLE", availability: true },
  { block_id: 15, track_id: 6, block_code: "B015", start_chainage: 50, end_chainage: 80, status: "AVAILABLE", availability: true },
  { block_id: 16, track_id: 7, block_code: "B101", start_chainage: 0, end_chainage: 220, status: "AVAILABLE", availability: true },
  { block_id: 17, track_id: 7, block_code: "B102", start_chainage: 220, end_chainage: 500, status: "AVAILABLE", availability: true },
  { block_id: 18, track_id: 7, block_code: "B103", start_chainage: 500, end_chainage: 800, status: "AVAILABLE", availability: true },
  { block_id: 19, track_id: 8, block_code: "B105", start_chainage: 0, end_chainage: 350, status: "AVAILABLE", availability: true },
  { block_id: 20, track_id: 8, block_code: "B106", start_chainage: 350, end_chainage: 700, status: "AVAILABLE", availability: true },
  { block_id: 21, track_id: 8, block_code: "B107", start_chainage: 700, end_chainage: 1100, status: "UNDER_REPAIR", availability: false },
  { block_id: 22, track_id: 8, block_code: "B108", start_chainage: 1100, end_chainage: 1500, status: "AVAILABLE", availability: true },
  { block_id: 23, track_id: 8, block_code: "B109", start_chainage: 1500, end_chainage: 2100, status: "AVAILABLE", availability: true },
];

const blocks = rawBlocks.map((b) => ({
  ...b,
  track: trackMap.get(b.track_id),
}));

const blockIdMap = new Map(blocks.map((b) => [b.block_id, b]));
const blockCodeMap = new Map(blocks.map((b) => [b.block_code, b]));

// ── 7. Assets ────────────────────────────────────────────────────────────
const rawAssets = [
  { asset_id: 1, asset_code: "AST-001", asset_name: "Track Panel B001-A", asset_type: "TRACK_PANEL", block_id: 1, section_id: 1, status: "NEEDS_REPAIR", criticality: 4 },
  { asset_id: 2, asset_code: "AST-002", asset_name: "OHE Mast B001-KM5", asset_type: "OVERHEAD_EQUIPMENT", block_id: 1, section_id: 1, status: "OPERATIONAL", criticality: 3 },
  { asset_id: 3, asset_code: "AST-003", asset_name: "Signal B001-S3", asset_type: "SIGNAL", block_id: 1, section_id: 1, status: "OPERATIONAL", criticality: 4 },
  { asset_id: 4, asset_code: "AST-004", asset_name: "Track Panel B004-A", asset_type: "TRACK_PANEL", block_id: 4, section_id: 2, status: "OPERATIONAL", criticality: 2 },
  { asset_id: 5, asset_code: "AST-005", asset_name: "OHE Mast B004-KM8", asset_type: "OVERHEAD_EQUIPMENT", block_id: 4, section_id: 2, status: "OPERATIONAL", criticality: 2 },
  { asset_id: 6, asset_code: "AST-006", asset_name: "Track Panel B007-A", asset_type: "TRACK_PANEL", block_id: 7, section_id: 3, status: "OPERATIONAL", criticality: 3 },
  { asset_id: 7, asset_code: "AST-007", asset_name: "OHE Mast B007-KM3", asset_type: "OVERHEAD_EQUIPMENT", block_id: 7, section_id: 3, status: "NEEDS_INSPECTION", criticality: 3 },
  { asset_id: 8, asset_code: "AST-008", asset_name: "Track Panel B010-A", asset_type: "TRACK_PANEL", block_id: 10, section_id: 4, status: "OPERATIONAL", criticality: 2 },
  { asset_id: 9, asset_code: "AST-009", asset_name: "Signal B010-S1", asset_type: "SIGNAL", block_id: 10, section_id: 4, status: "DEFECTIVE", criticality: 4 },
  { asset_id: 10, asset_code: "AST-010", asset_name: "Track Panel B012-A", asset_type: "TRACK_PANEL", block_id: 12, section_id: 4, status: "UNDER_REPAIR", criticality: 4 },
  { asset_id: 11, asset_code: "AST-011", asset_name: "OHE Mast B012-KM2", asset_type: "OVERHEAD_EQUIPMENT", block_id: 12, section_id: 4, status: "UNDER_REPAIR", criticality: 3 },
  { asset_id: 12, asset_code: "AST-012", asset_name: "Track Panel B002-A", asset_type: "TRACK_PANEL", block_id: 2, section_id: 1, status: "OPERATIONAL", criticality: 1 },
  { asset_id: 13, asset_code: "AST-013", asset_name: "Signal B008-S2", asset_type: "SIGNAL", block_id: 8, section_id: 3, status: "OPERATIONAL", criticality: 2 },
  { asset_id: 14, asset_code: "AST-014", asset_name: "Track Panel B013-A", asset_type: "TRACK_PANEL", block_id: 13, section_id: 5, status: "OPERATIONAL", criticality: 2 },
  { asset_id: 15, asset_code: "AST-015", asset_name: "OHE Mast B014-KM1", asset_type: "OVERHEAD_EQUIPMENT", block_id: 14, section_id: 5, status: "OPERATIONAL", criticality: 1 },
];

const assets = rawAssets.map((a) => ({
  ...a,
  block: blockIdMap.get(a.block_id),
  section: sectionIdMap.get(a.section_id),
}));

const assetIdMap = new Map(assets.map((a) => [a.asset_id, a]));

// ── 8. Maintenance Tasks ─────────────────────────────────────────────────
const rawTasks = [
  {
    maintenance_task_id: 1, asset_id: 1, block_id: 1, section_id: 1, source: "TMS", external_ref: "TMS-2026-001",
    department: "ENGINEERING", maintenance_type: "Track Realignment",
    description: "Panel B001-A buckled due to thermal stress. Requires realignment of 150m section.",
    priority: 4, criticality: 4, urgency: 4, duration_minutes: 120,
    preferred_start: hoursFromBase(10), deadline: hoursFromBase(14), status: "PENDING",
  },
  {
    maintenance_task_id: 2, asset_id: 2, block_id: 1, section_id: 1, source: "TDMS", external_ref: "TDMS-2026-004",
    department: "TRACTION", maintenance_type: "OHE Wire Replacement",
    description: "Overhead equipment wire sag detected near B001-KM5. Wire replacement required.",
    priority: 3, criticality: 3, urgency: 3, duration_minutes: 90,
    preferred_start: hoursFromBase(10.5), deadline: hoursFromBase(14), status: "PENDING",
  },
  {
    maintenance_task_id: 3, asset_id: 3, block_id: 1, section_id: 1, source: "SMMS", external_ref: "SMMS-2026-012",
    department: "SIGNAL", maintenance_type: "Signal Calibration",
    description: "Signal B001-S3 showing intermittent aspects. Calibration and lens cleaning required.",
    priority: 3, criticality: 4, urgency: 3, duration_minutes: 60,
    preferred_start: hoursFromBase(10), deadline: hoursFromBase(13), status: "PENDING",
  },
  {
    maintenance_task_id: 4, asset_id: 4, block_id: 4, section_id: 2, source: "TMS", external_ref: "TMS-2026-018",
    department: "ENGINEERING", maintenance_type: "Routine Track Inspection",
    description: "Scheduled quarterly inspection of track geometry and fastening systems.",
    priority: 1, criticality: 1, urgency: 1, duration_minutes: 180,
    preferred_start: hoursFromBase(6), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 5, asset_id: 5, block_id: 4, section_id: 2, source: "TDMS", external_ref: "TDMS-2026-022",
    department: "TRACTION", maintenance_type: "OHE Annual Inspection",
    description: "Annual inspection of overhead equipment on Delhi-Ambala main line section.",
    priority: 2, criticality: 2, urgency: 2, duration_minutes: 120,
    preferred_start: hoursFromBase(6.5), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 6, asset_id: 7, block_id: 7, section_id: 3, source: "TDMS", external_ref: "TDMS-2026-031",
    department: "TRACTION", maintenance_type: "OHE Tensioning Correction",
    description: "OHE tensioning out of spec. Deadline: regulation inspection in 2 days.",
    priority: 4, criticality: 3, urgency: 4, duration_minutes: 60,
    preferred_start: hoursFromBase(20), deadline: hoursFromBase(48), status: "PENDING",
  },
  {
    maintenance_task_id: 7, asset_id: 9, block_id: 10, section_id: 4, source: "SMMS", external_ref: "SMMS-2026-045",
    department: "SIGNAL", maintenance_type: "Signal Aspect Replacement",
    description: "Signal B010-S1 red aspect failure. Immediate replacement of LED module required.",
    priority: 4, criticality: 4, urgency: 4, duration_minutes: 45,
    preferred_start: hoursFromBase(14), deadline: hoursFromBase(16), status: "PENDING",
  },
  {
    maintenance_task_id: 8, asset_id: 10, block_id: 12, section_id: 4, source: "TMS", external_ref: "TMS-2026-052",
    department: "ENGINEERING", maintenance_type: "Major Track Renewal",
    description: "Complete track renewal on B012. Ballast, sleeper and rail replacement.",
    priority: 3, criticality: 4, urgency: 2, duration_minutes: 480,
    preferred_start: hoursFromBase(0), deadline: hoursFromBase(72), status: "IN_PROGRESS",
  },
  {
    maintenance_task_id: 9, asset_id: 13, block_id: 8, section_id: 3, source: "SMMS", external_ref: "SMMS-2026-058",
    department: "SIGNAL", maintenance_type: "Level Crossing Alarm Test",
    description: "Periodic testing of level crossing warning systems at B008-LC3.",
    priority: 2, criticality: 2, urgency: 2, duration_minutes: 30,
    preferred_start: hoursFromBase(14), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 10, asset_id: 14, block_id: 13, section_id: 5, source: "TMS", external_ref: "TMS-2026-064",
    department: "ENGINEERING", maintenance_type: "Sleeper Replacement",
    description: "Replace 50 deteriorated concrete sleepers on B013.",
    priority: 2, criticality: 2, urgency: 1, duration_minutes: 240,
    preferred_start: hoursFromBase(22), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 11, asset_id: 15, block_id: 14, section_id: 5, source: "TDMS", external_ref: "TDMS-2026-070",
    department: "TRACTION", maintenance_type: "Dropper Replacement",
    description: "Replace 5 droppers on B014 OHE span.",
    priority: 1, criticality: 1, urgency: 1, duration_minutes: 45,
    preferred_start: hoursFromBase(22), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 12, asset_id: 12, block_id: 2, section_id: 1, source: "TMS", external_ref: "TMS-2026-075",
    department: "ENGINEERING", maintenance_type: "Ballast Cleaning",
    description: "Mechanical ballast cleaning on B002 curve section.",
    priority: 2, criticality: 2, urgency: 2, duration_minutes: 150,
    preferred_start: hoursFromBase(20), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 13, asset_id: 7, block_id: 7, section_id: 3, source: "TMS", external_ref: "TMS-2026-081",
    department: "ENGINEERING", maintenance_type: "Fencing Repair",
    description: "Boundary fencing damaged near B007-KM3. Repair 200m stretch.",
    priority: 1, criticality: 1, urgency: 1, duration_minutes: 90,
    preferred_start: hoursFromBase(8), deadline: null, status: "COMPLETED",
  },
  {
    maintenance_task_id: 14, asset_id: 6, block_id: 7, section_id: 3, source: "SMMS", external_ref: "SMMS-2026-089",
    department: "SIGNAL", maintenance_type: "Telecom Cable Jointing",
    description: "Joint replacement in telecom cable along B007.",
    priority: 2, criticality: 3, urgency: 2, duration_minutes: 60,
    preferred_start: hoursFromBase(15), deadline: hoursFromBase(40), status: "PENDING",
  },
  {
    maintenance_task_id: 15, asset_id: 1, block_id: 1, section_id: 1, source: "TMS", external_ref: "TMS-2026-092",
    department: "ENGINEERING", maintenance_type: "Rail Grinding",
    description: "Corrective rail grinding on B001 to address corrugation.",
    priority: 3, criticality: 2, urgency: 2, duration_minutes: 90,
    preferred_start: hoursFromBase(22), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 16, asset_id: 8, block_id: 10, section_id: 4, source: "TDMS", external_ref: "TDMS-2026-097",
    department: "TRACTION", maintenance_type: "Feeder Cable Replacement",
    description: "Traction feeder cable showing insulation degradation.",
    priority: 3, criticality: 3, urgency: 3, duration_minutes: 75,
    preferred_start: hoursFromBase(14.5), deadline: hoursFromBase(18), status: "PENDING",
  },
  {
    maintenance_task_id: 17, asset_id: 4, block_id: null, section_id: 2, source: "TMS", external_ref: "TMS-2026-104",
    department: "ENGINEERING", maintenance_type: "Culvert Cleaning",
    description: "Monsoon preparation: cleaning culverts along Delhi-Ambala section.",
    priority: 2, criticality: 2, urgency: 3, duration_minutes: 120,
    preferred_start: hoursFromBase(6), deadline: hoursFromBase(24), status: "PENDING",
  },
  {
    maintenance_task_id: 18, asset_id: 2, block_id: 1, section_id: 1, source: "SMMS", external_ref: "SMMS-2026-112",
    department: "SIGNAL", maintenance_type: "UPS Battery Replacement",
    description: "Replace signal house UPS batteries at B001 control point.",
    priority: 2, criticality: 3, urgency: 2, duration_minutes: 30,
    preferred_start: hoursFromBase(15), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 19, asset_id: 11, block_id: 12, section_id: 4, source: "TDMS", external_ref: "TDMS-2026-118",
    department: "TRACTION", maintenance_type: "Traction Substation Inspection",
    description: "Routine inspection of traction substation equipment near B012.",
    priority: 1, criticality: 2, urgency: 1, duration_minutes: 60,
    preferred_start: hoursFromBase(10), deadline: null, status: "PENDING",
  },
  {
    maintenance_task_id: 20, asset_id: 14, block_id: 13, section_id: 5, source: "SMMS", external_ref: "SMMS-2026-125",
    department: "SIGNAL", maintenance_type: "Axle Counter Calibration",
    description: "Calibrate axle counter heads at B013 block section marker.",
    priority: 3, criticality: 3, urgency: 3, duration_minutes: 40,
    preferred_start: hoursFromBase(16), deadline: hoursFromBase(20), status: "PENDING",
  },
];

const maintenanceTasks = rawTasks.map((t) => ({
  ...t,
  asset: assetIdMap.get(t.asset_id),
  block: blockIdMap.get(t.block_id) || null,
  section: sectionIdMap.get(t.section_id),
  requested_at: new Date("2026-09-17T12:00:00Z"),
}));

const taskIdMap = new Map(maintenanceTasks.map((t) => [t.maintenance_task_id, t]));

// ── 9. Complete 43 Trains Definition ────────────────────────────────────
const allRawTrains = [
  // === 1-10: Primary Regional Trains (from seed.js) ===
  { id: 1, num: "12301", name: "Howrah Rajdhani Express", type: "RAJDHANI", pri: 1, startH: 9.0, speed: 85, stops: ["NDLS", "DEE", "UMB"], moves: [["B001", 11.0, 11.25], ["B002", 11.33, 11.58]] },
  { id: 2, num: "12951", name: "Mumbai Rajdhani", type: "RAJDHANI", pri: 1, startH: 20.0, speed: 85, stops: ["BCT", "ST", "ADI"], moves: [["B010", 20.5, 20.83], ["B011", 21.0, 21.5]] },
  { id: 3, num: "12002", name: "New Delhi Shatabdi", type: "SHATABDI", pri: 2, startH: 8.0, speed: 80, stops: ["NDLS", "BGZ", "UMB"], moves: [["B004", 9.0, 9.25]] },
  { id: 4, num: "18237", name: "Chhattisgarh Express", type: "MAIL_EXPRESS", pri: 3, startH: 7.0, speed: 55, stops: ["MB", "BE", "LKO"], moves: [["B007", 7.5, 7.83], ["B008", 8.5, 9.0], ["B009", 10.5, 11.0]] },
  { id: 5, num: "14623", name: "Patalkot Express", type: "MAIL_EXPRESS", pri: 3, startH: 6.0, speed: 55, stops: ["MB", "BE"], moves: [["B007", 6.5, 6.83]] },
  { id: 6, num: "12472", name: "Swaraj Express", type: "SUPERFAST", pri: 2, startH: 14.0, speed: 65, stops: ["NDLS", "DLI"], moves: [["B004", 14.17, 14.33]] },
  { id: 7, num: "12925", name: "Paschim Express", type: "MAIL_EXPRESS", pri: 3, startH: 16.0, speed: 60, stops: ["NDLS", "ST", "BCT"], moves: [["B013", 16.25, 16.5]] },
  { id: 8, num: "19037", name: "Avadh Express", type: "MAIL_EXPRESS", pri: 4, startH: 13.0, speed: 50, stops: ["BE", "LKO"], moves: [] },
  { id: 9, num: "54311", name: "Delhi-Rohtak Passenger", type: "PASSENGER", pri: 4, startH: 10.5, speed: 45, stops: ["NDLS", "DEE"], moves: [["B001", 11.5, 11.83]] },
  { id: 10, num: "12903", name: "Golden Temple Mail", type: "MAIL_EXPRESS", pri: 2, startH: 18.0, speed: 65, stops: ["BCT", "ST", "ADI"], moves: [["B010", 18.5, 18.83], ["B011", 19.0, 19.5]] },

  // === 11-30: Long-Distance Expresses (from seed-longdistance.js) ===
  { id: 11, num: "12615", name: "Grand Trunk Express", type: "MAIL_EXPRESS", pri: 3, startH: 5.0, speed: 60, stops: ["MAS", "GDR", "NLR", "BZA", "KZJ", "NGP", "ET", "JBP", "BPL", "GWL", "AGC", "NDLS"], moves: [["B001", 35.0, 35.4]] },
  { id: 12, num: "12627", name: "Karnataka Express", type: "SUPERFAST", pri: 3, startH: 8.0, speed: 65, stops: ["SBC", "GTL", "SUR", "BPL", "GWL", "AGC", "NDLS"], moves: [["B002", 37.0, 37.5]] },
  { id: 13, num: "12625", name: "Kerala Express", type: "MAIL_EXPRESS", pri: 3, startH: 12.0, speed: 60, stops: ["TVC", "QLN", "ERS", "CLT", "MAO", "LTT", "BSL", "BPL", "AGC", "NDLS"], moves: [["B001", 48.0, 48.6]] },
  { id: 14, num: "12303", name: "Poorva Express", type: "MAIL_EXPRESS", pri: 3, startH: 16.0, speed: 65, stops: ["HWH", "DGR", "GAYA", "DDU", "CNB", "NDLS"], moves: [["B003", 34.0, 34.5]] },
  { id: 15, num: "12839", name: "Howrah-Chennai Mail", type: "MAIL_EXPRESS", pri: 3, startH: 21.0, speed: 58, stops: ["HWH", "BLS", "BBS", "VSKP", "VZM", "BZA", "GDR", "MAS"], moves: [] },
  { id: 16, num: "12163", name: "Chennai-Mumbai Express", type: "MAIL_EXPRESS", pri: 3, startH: 9.0, speed: 58, stops: ["MAS", "KJM", "SBC", "GTL", "SUR", "PUNE", "CSMT"], moves: [["B013", 30.5, 31.0]] },
  { id: 17, num: "12137", name: "Punjab Mail", type: "MAIL_EXPRESS", pri: 3, startH: 13.0, speed: 60, stops: ["CSMT", "BSL", "NGP", "BPL", "AGC", "NDLS", "LDH", "FZR"], moves: [["B004", 39.0, 39.4]] },
  { id: 18, num: "12423", name: "Dibrugarh Rajdhani", type: "RAJDHANI", pri: 1, startH: 7.0, speed: 75, stops: ["NDLS", "CNB", "LKO", "GKP", "NJP", "NBQ", "GHY", "LMG", "DBRG"], moves: [["B005", 8.0, 8.4]] },
  { id: 19, num: "12509", name: "Guwahati-SMVT Bengaluru SF Express", type: "SUPERFAST", pri: 3, startH: 18.0, speed: 62, stops: ["GHY", "NBQ", "KIR", "JSG", "TATA", "VZM", "BZA", "GTL", "SBC"], moves: [] },
  { id: 20, num: "15635", name: "Gandhidham-Guwahati Express", type: "EXPRESS", pri: 3, startH: 3.0, speed: 55, stops: ["GIMB", "ADI", "ABR", "JP", "AGC", "CNB", "GKP", "NJP", "GHY"], moves: [] },
  { id: 21, num: "12905", name: "West Bengal Sampark Kranti", type: "MAIL_EXPRESS", pri: 3, startH: 10.0, speed: 62, stops: ["HWH", "KGP", "NGP", "ET", "RTM", "BRC", "ADI", "RJT", "PBR"], moves: [["B010", 32.0, 32.5]] },
  { id: 22, num: "12308", name: "Howrah-Jodhpur Express", type: "MAIL_EXPRESS", pri: 3, startH: 23.0, speed: 60, stops: ["HWH", "DGR", "GAYA", "PRYJ", "CNB", "AGC", "SWM", "JP", "BGKT"], moves: [] },
  { id: 23, num: "12723", name: "Telangana Express", type: "SUPERFAST", pri: 3, startH: 2.0, speed: 68, stops: ["HYB", "KZJ", "NGP", "BPL", "GWL", "AGC", "NDLS"], moves: [["B001", 24.0, 24.4]] },
  { id: 24, num: "12801", name: "Purushottam Express", type: "MAIL_EXPRESS", pri: 3, startH: 6.0, speed: 62, stops: ["PURI", "BBS", "CTC", "ROU", "TATA", "GMO", "PRYJ", "CNB", "NDLS"], moves: [["B002", 33.0, 33.5]] },
  { id: 25, num: "12958", name: "Swarna Jayanti Rajdhani", type: "RAJDHANI", pri: 1, startH: 15.0, speed: 80, stops: ["ASR", "UMB", "NDLS", "AGC", "BPL", "PUNE", "KPD", "MAS"], moves: [["B004", 17.0, 17.3], ["B014", 32.0, 32.4]] },
  { id: 26, num: "12967", name: "Jaipur-Chennai Express", type: "SUPERFAST", pri: 3, startH: 19.0, speed: 62, stops: ["JP", "SWM", "BRC", "ST", "PUNE", "GTL", "SBC", "KPD", "MAS"], moves: [["B013", 26.0, 26.4]] },
  { id: 27, num: "12621", name: "Tamil Nadu Express", type: "SUPERFAST", pri: 3, startH: 22.0, speed: 70, stops: ["NDLS", "AGC", "BPL", "ET", "NGP", "BZA", "GDR", "MAS"], moves: [["B001", 22.2, 22.6]] },
  { id: 28, num: "12311", name: "Howrah-Jammu Tawi Express", type: "MAIL_EXPRESS", pri: 3, startH: 4.0, speed: 58, stops: ["HWH", "DGR", "GAYA", "CNB", "NDLS", "UMB", "JAT"], moves: [["B005", 28.0, 28.5]] },
  { id: 29, num: "16346", name: "Netravati Express", type: "SUPERFAST", pri: 3, startH: 11.0, speed: 60, stops: ["TVC", "QLN", "ERS", "CLT", "MAO", "PNVL", "LTT"], moves: [["B013", 35.0, 35.5]] },
  { id: 30, num: "12841", name: "Coromandel Express", type: "MAIL_EXPRESS", pri: 3, startH: 17.0, speed: 68, stops: ["SHM", "KGP", "BBS", "VSKP", "BZA", "GDR", "MAS"], moves: [] },

  // === 31: Sanghamitra Express (from seed-sanghamitra.js) ===
  { id: 31, num: "12313", name: "Sanghamitra Express", type: "SUPERFAST", pri: 2, startH: 21.0, speed: 65, stops: ["SMVB", "KJM", "BWT", "JTJ", "SA", "ED", "TPJ", "TPTY", "MAS", "NLR", "BZA", "KMM", "WL", "BPQ", "NGP", "JBP", "KTE", "MKP", "PRYJ", "DDU", "DNR"], moves: [["B101", 21.0, 22.2], ["B102", 22.2, 24.2], ["B105", 30.4, 34.6]] },

  // === 32-35: Vande Bharat Expresses (from seed-priority.js) ===
  { id: 32, num: "20901", name: "Vande Bharat Express (Prayagraj)", type: "VANDE_BHARAT", pri: 1, startH: 6.0, speed: 95, stops: ["PRYJ", "CNB", "NDLS"], moves: [["B001", 11.8, 12.1]] },
  { id: 33, num: "20605", name: "Vande Bharat Express (Chennai-Bengaluru)", type: "VANDE_BHARAT", pri: 1, startH: 8.0, speed: 95, stops: ["MAS", "KJM", "SBC"], moves: [["B101", 11.5, 12.0]] },
  { id: 34, num: "22435", name: "Vande Bharat Express (Vande Bharat Special)", type: "VANDE_BHARAT", pri: 1, startH: 7.0, speed: 100, stops: ["NDLS", "AGC", "BSL", "PUNE", "BCT"], moves: [["B001", 7.2, 7.5], ["B014", 19.5, 20.0]] },
  { id: 35, num: "22439", name: "Vande Bharat Express (Eastern Express)", type: "VANDE_BHARAT", pri: 1, startH: 10.0, speed: 95, stops: ["HWH", "GAYA", "CNB", "NDLS"], moves: [["B003", 19.0, 19.4]] },

  // === 36-41: Local / Suburban MEMU / DEMU (from seed-priority.js) ===
  { id: 36, num: "64421", name: "Delhi-Ambala MEMU", type: "MEMU", pri: 5, startH: 15.0, speed: 45, stops: ["NDLS", "DEE", "UMB"], moves: [["B004", 16.0, 16.5]] },
  { id: 37, num: "64425", name: "Mumbai Shuttle MEMU", type: "MEMU", pri: 5, startH: 14.0, speed: 45, stops: ["CSMT", "PNVL", "PUNE"], moves: [["B013", 14.8, 15.2]] },
  { id: 38, num: "66451", name: "Chennai-Nellore MEMU", type: "MEMU", pri: 5, startH: 6.0, speed: 45, stops: ["MAS", "GDR", "NLR"], moves: [] },
  { id: 39, num: "66551", name: "Chennai-Bangalore MEMU", type: "MEMU", pri: 5, startH: 12.0, speed: 45, stops: ["MAS", "KJM", "KPD", "SBC"], moves: [["B101", 17.0, 17.5]] },
  { id: 40, num: "74201", name: "Bangalore-Katpadi DEMU", type: "DEMU", pri: 5, startH: 17.0, speed: 50, stops: ["SBC", "KPD"], moves: [] },
  { id: 41, num: "75601", name: "Guwahati-Bongaigaon DEMU", type: "DEMU", pri: 5, startH: 20.0, speed: 50, stops: ["GHY", "NBQ"], moves: [] },

  // === 42-43: Regional Passenger Trains (from seed-priority.js) ===
  { id: 42, num: "64301", name: "Mumbai-Ahmedabad Passenger", type: "PASSENGER", pri: 4, startH: 11.0, speed: 45, stops: ["BCT", "ADI"], moves: [["B010", 12.0, 12.6]] },
  { id: 43, num: "64411", name: "Delhi-Kanpur Passenger", type: "PASSENGER", pri: 4, startH: 5.0, speed: 50, stops: ["NDLS", "CNB"], moves: [["B001", 5.4, 5.9]] },
];

let trainRouteIdCounter = 1;
let movementIdCounter = 1;

const trains = allRawTrains.map((t) => {
  const stopList = (t.stops || []).map((code) => stationCodeMap.get(code)).filter(Boolean);
  const origStation = stopList[0] || stations[0];
  const destStation = stopList[stopList.length - 1] || stations[1];

  // Calculate route timings based on station coordinates and speed
  const departures = [t.startH];
  for (let i = 1; i < stopList.length; i += 1) {
    const prevCoord = [stopList[i - 1].latitude, stopList[i - 1].longitude];
    const currCoord = [stopList[i].latitude, stopList[i].longitude];
    const legKm = distanceKm(prevCoord, currCoord);
    const travelHours = legKm / (t.speed || 60);
    const arrH = departures[i - 1] + travelHours;
    const isTerminal = i === stopList.length - 1;
    departures.push(isTerminal ? arrH : arrH + 0.25);
  }

  const arrivals = [null];
  for (let i = 1; i < stopList.length; i += 1) {
    const prevCoord = [stopList[i - 1].latitude, stopList[i - 1].longitude];
    const currCoord = [stopList[i].latitude, stopList[i].longitude];
    const legKm = distanceKm(prevCoord, currCoord);
    const travelHours = legKm / (t.speed || 60);
    arrivals.push(departures[i - 1] + travelHours);
  }

  const train_routes = stopList.map((st, idx) => ({
    train_route_id: trainRouteIdCounter++,
    train_id: t.id,
    station_id: st.station_id,
    sequence_number: idx + 1,
    scheduled_arrival: arrivals[idx] !== null ? hoursFromBase(arrivals[idx]) : null,
    scheduled_departure: idx < stopList.length - 1 ? hoursFromBase(departures[idx]) : null,
    station: st,
  }));

  const train_block_movements = (t.moves || []).map(([bCode, entryH, exitH]) => {
    const blk = blockCodeMap.get(bCode) || blocks[0];
    return {
      movement_id: movementIdCounter++,
      train_id: t.id,
      block_id: blk.block_id,
      scheduled_entry: hoursFromBase(entryH),
      scheduled_exit: hoursFromBase(exitH),
      block: blk,
    };
  });

  return {
    train_id: t.id,
    train_number: t.num,
    train_name: t.name,
    train_type: t.type,
    origin_station_id: origStation.station_id,
    destination_station_id: destStation.station_id,
    priority: t.pri,
    status: "ACTIVE",
    origin_station: origStation,
    destination_station: destStation,
    train_routes,
    train_block_movements,
  };
});

const trainIdMap = new Map(trains.map((t) => [t.train_id, t]));

// ── 10. Sample Block Plans / Schedules ───────────────────────────────────
const blockPlans = [
  {
    plan_id: 1,
    block_id: 1,
    status: "PLANNED",
    planned_start: hoursFromBase(10.0),
    planned_end: hoursFromBase(12.0),
    actual_start: null,
    actual_end: null,
    created_at: new Date("2026-09-18T06:00:00Z"),
    block: blockIdMap.get(1),
    _count: {
      plan_maintenance_tasks: 3,
      plan_train_impacts: 2,
      block_conflicts: 2,
      block_operations: 2,
    },
    plan_maintenance_tasks: [
      { plan_maintenance_task_id: 1, plan_id: 1, maintenance_task_id: 1, maintenance_task: taskIdMap.get(1) },
      { plan_maintenance_task_id: 2, plan_id: 1, maintenance_task_id: 2, maintenance_task: taskIdMap.get(2) },
      { plan_maintenance_task_id: 3, plan_id: 1, maintenance_task_id: 3, maintenance_task: taskIdMap.get(3) },
    ],
    plan_train_impacts: [
      { impact_id: 1, plan_id: 1, train_id: 1, delay_minutes: 25, impact_type: "REGULATION", train: trainIdMap.get(1) },
      { impact_id: 2, plan_id: 1, train_id: 9, delay_minutes: 30, impact_type: "RESCHEDULED", train: trainIdMap.get(9) },
    ],
    block_conflicts: [
      {
        conflict_id: 1,
        plan_id: 1,
        train_id: 1,
        conflict_type: "TRAIN_MAINTENANCE",
        severity: "HIGH",
        description: "Train 12301 (Howrah Rajdhani) entry scheduled at 11:00 overlaps maintenance closure by 25 min.",
        train: trainIdMap.get(1),
      },
      {
        conflict_id: 2,
        plan_id: 1,
        train_id: 9,
        conflict_type: "TRAIN_MAINTENANCE",
        severity: "MEDIUM",
        description: "Train 54311 (Delhi-Rohtak Passenger) scheduled at 11:30 overlaps maintenance closure by 30 min.",
        train: trainIdMap.get(9),
      },
    ],
    block_operations: [
      { operation_id: 1, plan_id: 1, operation_type: "POWER_SHUTDOWN", status: "SCHEDULED", scheduled_time: hoursFromBase(9.8) },
      { operation_id: 2, plan_id: 1, operation_type: "TRACK_POSSESSION", status: "SCHEDULED", scheduled_time: hoursFromBase(10.0) },
    ],
  },
  {
    plan_id: 2,
    block_id: 7,
    status: "PLANNED",
    planned_start: hoursFromBase(20.0),
    planned_end: hoursFromBase(21.0),
    actual_start: null,
    actual_end: null,
    created_at: new Date("2026-09-18T07:00:00Z"),
    block: blockIdMap.get(7),
    _count: {
      plan_maintenance_tasks: 1,
      plan_train_impacts: 0,
      block_conflicts: 0,
      block_operations: 1,
    },
    plan_maintenance_tasks: [
      { plan_maintenance_task_id: 4, plan_id: 2, maintenance_task_id: 6, maintenance_task: taskIdMap.get(6) },
    ],
    plan_train_impacts: [],
    block_conflicts: [],
    block_operations: [
      { operation_id: 3, plan_id: 2, operation_type: "OHE_ISOLATION", status: "SCHEDULED", scheduled_time: hoursFromBase(19.9) },
    ],
  },
  {
    plan_id: 3,
    block_id: 10,
    status: "PLANNED",
    planned_start: hoursFromBase(14.0),
    planned_end: hoursFromBase(15.25),
    actual_start: null,
    actual_end: null,
    created_at: new Date("2026-09-18T08:00:00Z"),
    block: blockIdMap.get(10),
    _count: {
      plan_maintenance_tasks: 2,
      plan_train_impacts: 1,
      block_conflicts: 1,
      block_operations: 1,
    },
    plan_maintenance_tasks: [
      { plan_maintenance_task_id: 5, plan_id: 3, maintenance_task_id: 7, maintenance_task: taskIdMap.get(7) },
      { plan_maintenance_task_id: 6, plan_id: 3, maintenance_task_id: 16, maintenance_task: taskIdMap.get(16) },
    ],
    plan_train_impacts: [
      { impact_id: 3, plan_id: 3, train_id: 10, delay_minutes: 15, impact_type: "SPEED_RESTRICTION", train: trainIdMap.get(10) },
    ],
    block_conflicts: [
      {
        conflict_id: 3,
        plan_id: 3,
        train_id: 10,
        conflict_type: "TRAIN_MAINTENANCE",
        severity: "LOW",
        description: "Train 12903 (Golden Temple Mail) regulated at previous siding for 15 min.",
        train: trainIdMap.get(10),
      },
    ],
    block_operations: [
      { operation_id: 4, plan_id: 3, operation_type: "SIGNAL_DISCONNECTION", status: "SCHEDULED", scheduled_time: hoursFromBase(13.9) },
    ],
  },
];

const planIdMap = new Map(blockPlans.map((p) => [p.plan_id, p]));

module.exports = {
  zones,
  divisions,
  sections,
  stations,
  tracks,
  blocks,
  assets,
  maintenanceTasks,
  trains,
  blockPlans,
  stationCodeMap,
  stationIdMap,
  blockIdMap,
  blockCodeMap,
  assetIdMap,
  taskIdMap,
  trainIdMap,
  planIdMap,
};
