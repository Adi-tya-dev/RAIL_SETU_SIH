/**
 * railwayNetwork.js
 *
 * Indian Railway Network Graph for Dynamic Rerouting Pathfinder.
 *
 * Nodes  = Major junctions / stations (station_code → metadata + coordinates)
 * Edges  = Track segments connecting nodes (bidirectional)
 *          [from, to, distance_km, max_speed_kmh, track_type, line_capacity_per_day]
 *
 * Track Types:
 *   MAIN   - Main trunk / double-line corridor (high capacity)
 *   CHORD  - Chord / bypass / loop line (lower capacity, longer)
 *   LOOP   - Yard loop or short connect (very low capacity)
 *
 * Block-to-Segment Mapping:
 *   Each maintenance block code maps to the specific edges it physically blocks.
 *   The pathfinder removes these edges from the graph before running Dijkstra.
 */

const STATIONS = {
  // ─── South India ──────────────────────────────────────────────────────────
  MAS:  { name: "Chennai Central",          lat: 13.0827, lng: 80.2707, type: "MAJOR_TERMINAL" },
  MSB:  { name: "Chennai Beach",            lat: 13.1003, lng: 80.2884, type: "TERMINAL" },
  GDR:  { name: "Gudur Junction",           lat: 14.1478, lng: 79.8590, type: "JUNCTION" },
  NLR:  { name: "Nellore",                  lat: 14.4505, lng: 79.9860, type: "STATION" },
  OGL:  { name: "Ongole",                   lat: 15.5057, lng: 80.0499, type: "STATION" },
  BZA:  { name: "Vijayawada Junction",      lat: 16.5162, lng: 80.6480, type: "MAJOR_JUNCTION" },
  GNT:  { name: "Guntur Junction",          lat: 16.3067, lng: 80.4365, type: "JUNCTION" },
  VZM:  { name: "Vizianagaram Junction",    lat: 18.1066, lng: 83.3956, type: "JUNCTION" },
  VSKP: { name: "Visakhapatnam Junction",   lat: 17.6868, lng: 83.2185, type: "MAJOR_JUNCTION" },
  SA:   { name: "Salem Junction",           lat: 11.6643, lng: 78.1460, type: "JUNCTION" },
  JTJ:  { name: "Jolarpettai Junction",     lat: 12.5620, lng: 78.5830, type: "JUNCTION" },
  SBC:  { name: "Bangalore City Junction",  lat: 12.9767, lng: 77.5713, type: "MAJOR_JUNCTION" },
  MYS:  { name: "Mysuru Junction",          lat: 12.3052, lng: 76.6551, type: "JUNCTION" },
  CBE:  { name: "Coimbatore Junction",      lat: 11.0168, lng: 76.9558, type: "JUNCTION" },
  ED:   { name: "Erode Junction",           lat: 11.3410, lng: 77.7172, type: "JUNCTION" },
  TPJ:  { name: "Tiruchirappalli Junction", lat: 10.8050, lng: 78.6856, type: "JUNCTION" },
  MDU:  { name: "Madurai Junction",         lat:  9.9195, lng: 78.1193, type: "JUNCTION" },
  TVC:  { name: "Thiruvananthapuram Central",lat: 8.4855, lng: 76.9492, type: "MAJOR_JUNCTION" },
  ERS:  { name: "Ernakulam Junction",       lat: 10.0000, lng: 76.2867, type: "JUNCTION" },

  // ─── Telangana / Andhra sector ───────────────────────────────────────────
  SC:   { name: "Secunderabad Junction",    lat: 17.4344, lng: 78.5013, type: "MAJOR_JUNCTION" },
  HYB:  { name: "Hyderabad Deccan",         lat: 17.3850, lng: 78.4867, type: "JUNCTION" },
  WL:   { name: "Warangal",                 lat: 17.9784, lng: 79.5941, type: "JUNCTION" },
  KZJ:  { name: "Kazipet Junction",         lat: 17.9700, lng: 79.4200, type: "JUNCTION" },
  RDM:  { name: "Ramagundam",               lat: 18.7600, lng: 79.4800, type: "STATION" },
  ADB:  { name: "Adilabad",                 lat: 19.6641, lng: 78.5320, type: "JUNCTION" },
  NED:  { name: "Nanded Junction",          lat: 19.1591, lng: 77.3218, type: "JUNCTION" },
  PAU:  { name: "Parli Vaijnath",           lat: 18.8505, lng: 76.5295, type: "STATION" },

  // ─── Nagpur / Vidarbha sector ─────────────────────────────────────────────
  NGP:  { name: "Nagpur Junction",          lat: 21.1458, lng: 79.0882, type: "MAJOR_JUNCTION" },
  WR:   { name: "Wardha Junction",          lat: 20.7452, lng: 78.6034, type: "JUNCTION" },
  CHNR: { name: "Chandrapur",               lat: 19.9536, lng: 79.2998, type: "STATION" },
  BPQ:  { name: "Balharshah Junction",      lat: 19.8443, lng: 79.3508, type: "JUNCTION" },
  G:    { name: "Gondia Junction",          lat: 21.4640, lng: 80.1964, type: "JUNCTION" },
  BD:   { name: "Bhandara Road",            lat: 21.1589, lng: 79.6534, type: "STATION" },
  DURG: { name: "Durg Junction",            lat: 21.1924, lng: 81.2853, type: "JUNCTION" },
  R:    { name: "Raipur Junction",          lat: 21.2514, lng: 81.6296, type: "JUNCTION" },
  BSP:  { name: "Bilaspur Junction",        lat: 22.0844, lng: 82.1499, type: "MAJOR_JUNCTION" },
  SDL:  { name: "Shahdol",                  lat: 23.3000, lng: 81.3600, type: "STATION" },

  // ─── Jabalpur / Central India ─────────────────────────────────────────────
  JBP:  { name: "Jabalpur Junction",        lat: 23.1737, lng: 79.9419, type: "JUNCTION" },
  KTE:  { name: "Katni Junction",           lat: 23.8333, lng: 80.4167, type: "JUNCTION" },
  SGO:  { name: "Saugor (Sagar)",           lat: 23.8388, lng: 78.7322, type: "STATION" },
  BHS:  { name: "Bina Junction",            lat: 24.1736, lng: 78.1446, type: "JUNCTION" },
  ET:   { name: "Itarsi Junction",          lat: 22.6114, lng: 77.7616, type: "MAJOR_JUNCTION" },
  BPL:  { name: "Bhopal Junction",          lat: 23.2599, lng: 77.4126, type: "MAJOR_JUNCTION" },
  VDA:  { name: "Vidisha",                  lat: 23.5258, lng: 77.8095, type: "STATION" },
  MKP:  { name: "Maksi",                    lat: 23.2667, lng: 76.1500, type: "JUNCTION" },
  UJN:  { name: "Ujjain Junction",          lat: 23.1765, lng: 75.7885, type: "JUNCTION" },
  RTM:  { name: "Ratlam Junction",          lat: 23.3315, lng: 75.0367, type: "JUNCTION" },

  // ─── Delhi / NCR ──────────────────────────────────────────────────────────
  NDLS: { name: "New Delhi",                lat: 28.6448, lng: 77.2167, type: "MAJOR_TERMINAL" },
  DLI:  { name: "Old Delhi Junction",       lat: 28.6562, lng: 77.2150, type: "MAJOR_JUNCTION" },
  DEE:  { name: "Delhi Sarai Rohilla",      lat: 28.6706, lng: 77.1814, type: "JUNCTION" },
  AGC:  { name: "Agra Cantt",               lat: 27.1767, lng: 78.0081, type: "JUNCTION" },
  MTJ:  { name: "Mathura Junction",         lat: 27.4924, lng: 77.6737, type: "JUNCTION" },
  GWL:  { name: "Gwalior Junction",         lat: 26.2183, lng: 78.1828, type: "JUNCTION" },
  JHS:  { name: "Jhansi Junction",          lat: 25.4485, lng: 78.5685, type: "MAJOR_JUNCTION" },
  CNB:  { name: "Kanpur Central",           lat: 26.4499, lng: 80.3319, type: "MAJOR_JUNCTION" },
  ALD:  { name: "Prayagraj Junction",       lat: 25.4358, lng: 81.8463, type: "MAJOR_JUNCTION" },

  // ─── UP / Bihar ───────────────────────────────────────────────────────────
  LKO:  { name: "Lucknow Junction",         lat: 26.8467, lng: 80.9462, type: "MAJOR_JUNCTION" },
  MBD:  { name: "Moradabad Junction",       lat: 28.8386, lng: 78.7733, type: "JUNCTION" },
  DDU:  { name: "Pt. DDU Junction (MGS)",   lat: 25.2833, lng: 83.1167, type: "MAJOR_JUNCTION" },
  BSB:  { name: "Varanasi Junction",        lat: 25.3176, lng: 82.9739, type: "MAJOR_JUNCTION" },
  GAYA: { name: "Gaya Junction",            lat: 24.7914, lng: 84.9994, type: "JUNCTION" },
  PNBE: { name: "Patna Junction",           lat: 25.5941, lng: 85.1376, type: "MAJOR_JUNCTION" },
  DGR:  { name: "Durgapur",                 lat: 23.5204, lng: 87.3119, type: "STATION" },
  ASN:  { name: "Asansol Junction",         lat: 23.6835, lng: 86.9742, type: "JUNCTION" },

  // ─── West Bengal / Eastern ────────────────────────────────────────────────
  HWH:  { name: "Howrah Junction",          lat: 22.5839, lng: 88.3236, type: "MAJOR_TERMINAL" },
  KOAA: { name: "Kolkata (Chitpur)",        lat: 22.5726, lng: 88.3639, type: "TERMINAL" },

  // ─── Punjab / Haryana ─────────────────────────────────────────────────────
  UMB:  { name: "Ambala Cantt Junction",    lat: 30.3783, lng: 76.8220, type: "MAJOR_JUNCTION" },
  LDH:  { name: "Ludhiana Junction",        lat: 30.9010, lng: 75.8573, type: "JUNCTION" },
  ASR:  { name: "Amritsar Junction",        lat: 31.6340, lng: 74.8723, type: "MAJOR_JUNCTION" },
  FZR:  { name: "Firozpur Cantt",           lat: 30.9217, lng: 74.6143, type: "JUNCTION" },
  CDG:  { name: "Chandigarh Junction",      lat: 30.7333, lng: 76.7794, type: "JUNCTION" },

  // ─── Rajasthan / Gujarat ──────────────────────────────────────────────────
  JP:   { name: "Jaipur Junction",          lat: 26.9124, lng: 75.7873, type: "MAJOR_JUNCTION" },
  AII:  { name: "Ajmer Junction",           lat: 26.4499, lng: 74.6399, type: "JUNCTION" },
  ADI:  { name: "Ahmedabad Junction",       lat: 23.0255, lng: 72.5987, type: "MAJOR_JUNCTION" },
  BRC:  { name: "Vadodara Junction",        lat: 22.3072, lng: 73.1812, type: "JUNCTION" },
  ST:   { name: "Surat",                    lat: 21.1702, lng: 72.8311, type: "JUNCTION" },
  BVI:  { name: "Borivali",                 lat: 19.2292, lng: 72.8567, type: "STATION" },

  // ─── Mumbai ───────────────────────────────────────────────────────────────
  CSTM: { name: "Mumbai CSMT",              lat: 18.9398, lng: 72.8356, type: "MAJOR_TERMINAL" },
  LTT:  { name: "Mumbai LTT",               lat: 19.0726, lng: 72.9021, type: "TERMINAL" },
  KYN:  { name: "Kalyan Junction",          lat: 19.2403, lng: 73.1305, type: "MAJOR_JUNCTION" },
  BSL:  { name: "Bhusaval Junction",        lat: 21.0432, lng: 75.7777, type: "MAJOR_JUNCTION" },
  PUNE: { name: "Pune Junction",            lat: 18.5204, lng: 73.8567, type: "MAJOR_JUNCTION" },
  PNVL: { name: "Panvel Junction",          lat: 18.9894, lng: 73.1175, type: "JUNCTION" },
  SUR:  { name: "Solapur Junction",         lat: 17.6868, lng: 75.9064, type: "JUNCTION" },
  GR:   { name: "Gulbarga (Kalaburagi)",    lat: 17.3297, lng: 76.8343, type: "JUNCTION" },

  // ─── Jharkhand / Odisha ───────────────────────────────────────────────────
  RNC:  { name: "Ranchi Junction",          lat: 23.3441, lng: 85.3096, type: "JUNCTION" },
  DHN:  { name: "Dhanbad Junction",         lat: 23.7957, lng: 86.4304, type: "JUNCTION" },
  BWT:  { name: "Barkakana Junction",       lat: 23.5800, lng: 85.0900, type: "JUNCTION" },
  VSKP2:{ name: "Vizag (via Sambalpur)",    lat: 21.4669, lng: 83.9812, type: "JUNCTION" }, // SBP
};

/**
 * Track segment edges (bidirectional).
 * Format: [from, to, distance_km, max_speed_kmh, track_type, daily_capacity]
 */
const EDGES = [
  // ─── Grand Trunk Express Corridor: MAS ↔ NDLS ─────────────────────────────
  ["MAS",  "GDR",  178, 130, "MAIN",  60],
  ["GDR",  "NLR",   40, 110, "MAIN",  60],
  ["NLR",  "OGL",   95, 110, "MAIN",  55],
  ["OGL",  "BZA",   85, 130, "MAIN",  60],
  ["BZA",  "KZJ",  250, 120, "MAIN",  50],
  ["KZJ",  "WL",    15, 110, "MAIN",  50],
  ["NGP",  "ET",   185, 110, "MAIN",  40],
  ["ET",   "BPL",   90, 120, "MAIN",  50],
  ["BPL",  "BHS",  117, 110, "MAIN",  45],
  ["BHS",  "GWL",  202, 110, "MAIN",  45],
  ["GWL",  "AGC",  120, 120, "MAIN",  55],
  ["AGC",  "MTJ",   57, 120, "MAIN",  55],
  ["MTJ",  "NDLS", 140, 130, "MAIN",  70],

  // ET direct to JBP (alternate trunk)
  ["ET",   "JBP",  160, 110, "MAIN",  40],
  ["JBP",  "KTE",   95, 100, "MAIN",  40],
  ["KTE",  "GWL",  390, 100, "MAIN",  35],

  // ─── Wardha–Itarsi Chord Bypass (Real-world Nagpur Bypass Corridor) ─────────
  // Geographic South-to-North: KZJ (17.97N) -> BPQ (19.84N) -> CHNR (19.95N) -> WR (20.75N) -> ET (22.61N) -> JBP (23.17N)
  ["KZJ",  "BPQ",  235, 110, "MAIN",  50],
  ["BPQ",  "CHNR",  14, 100, "MAIN",  50],
  ["CHNR", "WR",    80, 100, "MAIN",  50],
  ["WR",   "NGP",   75, 100, "MAIN",  50],
  ["WR",   "ET",   280, 100, "CHORD", 35], // Wardha–Narkher–Itarsi bypass chord (bypasses Nagpur)
  ["WR",   "BSL",  314, 100, "MAIN",  40],
  ["NGP",  "JBP",  275, 110, "MAIN",  45],
  ["ET",   "JBP",  245, 110, "MAIN",  45],
  ["BPL",  "GWL",  390, 120, "MAIN",  50],
  ["JBP",  "GWL",  490, 100, "MAIN",  40],

  // ─── Raipur / Durg alternate (secondary bypass) ────────────────────────────
  ["NGP",  "DURG", 130, 100, "MAIN",  40],
  ["DURG", "R",     38, 110, "MAIN",  45],
  ["R",    "BSP",  112, 100, "MAIN",  40],
  ["BSP",  "KTE",  320,  90, "CHORD", 25],

  // ─── Adilabad / Nanded chord (southern bypass for KZJ-NGP) ─────────────────
  ["KZJ",  "ADB",  120,  80, "CHORD", 18],
  ["ADB",  "NED",  130,  80, "CHORD", 18],
  ["NED",  "PAU",  155,  80, "CHORD", 18],
  ["PAU",  "SUR",  180,  80, "CHORD", 16],

  // ─── Delhi–Howrah corridor ─────────────────────────────────────────────────
  ["NDLS", "CNB",  440, 130, "MAIN",  70],
  ["CNB",  "ALD",  200, 120, "MAIN",  65],
  ["ALD",  "DDU",  180, 120, "MAIN",  65],
  ["DDU",  "GAYA", 250, 100, "MAIN",  55],
  ["GAYA", "PNBE", 100, 110, "MAIN",  55],
  ["PNBE", "DHN",  310, 100, "MAIN",  50],
  ["DHN",  "ASN",   73, 100, "MAIN",  50],
  ["ASN",  "HWH",  213, 120, "MAIN",  65],

  // LKO diversion for Delhi-Howrah
  ["CNB",  "LKO",   80, 110, "MAIN",  50],
  ["LKO",  "ALD",  155, 110, "MAIN",  50],

  // Varanasi connector
  ["ALD",  "BSB",  130, 100, "MAIN",  50],
  ["DDU",  "BSB",   18,  80, "MAIN",  50],

  // ─── Delhi–Amritsar corridor ─────────────────────────────────────────────
  ["NDLS", "UMB",  200, 130, "MAIN",  60],
  ["UMB",  "LDH",   60, 120, "MAIN",  55],
  ["LDH",  "ASR",   90, 120, "MAIN",  55],
  ["UMB",  "CDG",   40, 110, "MAIN",  45],
  ["LDH",  "FZR",   90, 110, "MAIN",  40],

  // ─── Delhi–Mumbai corridor ───────────────────────────────────────────────
  ["NDLS", "AGC",  200, 130, "MAIN",  60],   // shared with GT corridor
  ["AGC",  "JHS",  270, 110, "MAIN",  45],
  ["JHS",  "ET",   200, 110, "MAIN",  45],
  ["ET",   "BSL",  210, 110, "MAIN",  45],
  ["BSL",  "KYN",  300, 110, "MAIN",  45],
  ["KYN",  "CSTM",  55,  80, "MAIN",  70],
  ["KYN",  "PUNE", 180, 110, "MAIN",  45],
  ["PUNE", "SUR",  240, 100, "MAIN",  40],
  ["SUR",  "GR",   380,  90, "CHORD", 30],
  ["GR",   "SC",   200, 100, "MAIN",  40],

  // Mumbai alternate via Vadodara-Surat
  ["ADI",  "BRC",  113, 130, "MAIN",  65],
  ["BRC",  "ST",   154, 130, "MAIN",  65],
  ["ST",   "BVI",  256, 110, "MAIN",  60],
  ["BVI",  "CSTM",  35,  80, "MAIN",  70],
  ["ADI",  "RTM",  252, 100, "MAIN",  40],
  ["RTM",  "MKP",  245,  90, "CHORD", 25],
  ["MKP",  "BPL",  280,  90, "CHORD", 25],

  // ─── South India internal ──────────────────────────────────────────────────
  ["MAS",  "JTJ",  215, 120, "MAIN",  50],
  ["JTJ",  "SBC",   90, 120, "MAIN",  55],
  ["JTJ",  "SA",   107,  90, "CHORD", 30],
  ["SA",   "CBE",  170, 100, "MAIN",  40],
  ["CBE",  "ERS",  193, 100, "MAIN",  40],
  ["ERS",  "TVC",  225, 100, "MAIN",  40],
  ["MAS",  "TPJ",  330, 110, "MAIN",  40],
  ["TPJ",  "MDU",  145, 100, "MAIN",  35],
  ["MDU",  "TVC",  310, 100, "MAIN",  35],
  ["SBC",  "SC",   560, 100, "MAIN",  45],
  ["SBC",  "MYS",  139, 110, "MAIN",  40],

  // ─── Hyderabad / Secunderabad sector ──────────────────────────────────────
  ["SC",   "HYB",   10,  60, "LOOP",  50],
  ["SC",   "KZJ",  156, 110, "MAIN",  50],
  ["SC",   "WL",   151, 110, "MAIN",  50],
  ["BZA",  "SC",   275, 110, "MAIN",  50],

  // ─── Rajasthan connector ───────────────────────────────────────────────────
  ["NDLS", "JP",   308, 120, "MAIN",  55],
  ["JP",   "AII",  135, 110, "MAIN",  45],
  ["AII",  "ADI",  490, 100, "MAIN",  40],
  ["JP",   "DEE",  308, 120, "MAIN",  55],

  // ─── Jharkhand / Odisha chord ─────────────────────────────────────────────
  ["DHN",  "BWT",  100,  80, "CHORD", 25],
  ["BWT",  "RNC",   55,  80, "CHORD", 25],
  ["DHN",  "ASN",   73, 100, "MAIN",  50],
  ["BSP",  "RNC",  220,  80, "CHORD", 25],

  // ─── DEE / BGZ connections ─────────────────────────────────────────────────
  ["NDLS", "DEE",   10,  60, "LOOP",  60],
  ["DLI",  "NDLS",   5,  60, "LOOP",  60],
  ["DDU",  "BSB",   18,  80, "MAIN",  50],
];

/**
 * BLOCK_SEGMENTS
 * Maps each maintenance block code to the specific edges (bidirectional) it disables.
 * Used by the pathfinder to remove blocked edges before running Dijkstra.
 *
 * Format: block_code → array of [stationA, stationB] pairs that are BLOCKED.
 */
const BLOCK_SEGMENTS = {
  // ─── Central Indian Corridor ────────────────────────────────────────────
  B001: [["KZJ", "NGP"], ["WL", "NGP"], ["NGP", "ET"], ["WR", "NGP"], ["NGP", "JBP"], ["G", "NGP"], ["BD", "NGP"], ["DURG", "NGP"]], // Nagpur junction block (Vidarbha sector)
  B002: [["NDLS", "DEE"], ["DLI", "NDLS"]],                // Delhi-Sarai Rohilla sector
  B003: [["DDU", "GAYA"], ["ALD", "DDU"]],                  // Mughal Sarai-Gaya sector
  B004: [["NDLS", "CNB"], ["CNB", "LKO"]],                  // Kanpur-Delhi (UP main)
  B005: [["UMB", "LDH"]],                                   // Ambala-Ludhiana sector
  B006: [["LDH", "ASR"]],                                   // Ludhiana-Amritsar sector
  B007: [["AGC", "GWL"]],                                   // Agra-Gwalior sector
  B008: [["GWL", "BHS"]],                                   // Gwalior-Bina sector
  B009: [["BHS", "BPL"]],                                   // Bina-Bhopal sector
  B010: [["BRC", "ST"]],                                    // Vadodara-Surat sector
  B011: [["ST", "BVI"]],                                    // Surat-Borivali sector
  B012: [["ADI", "BRC"]],                                   // Ahmedabad-Vadodara sector
  B013: [["PUNE", "SUR"], ["KYN", "PUNE"]],                 // Pune sector
  B014: [["KYN", "BSL"]],                                   // Kalyan-Bhusaval sector
  B015: [["BSL", "ET"]],                                    // Bhusaval-Itarsi sector
  B101: [["DHN", "BWT"]],                                   // Dhanbad-Barkakana sector
  B102: [["JTJ", "SBC"]],                                   // Jolarpettai-Bangalore sector
  B103: [["GDR", "NLR"]],                                   // Gudur-Nellore sector
  B104: [["BZA", "KZJ"]],                                   // Vijayawada-Kazipet sector
  B105: [["SC", "WL"], ["KZJ", "WL"]],                     // Warangal sector
  B106: [["BPQ", "G"], ["G", "NGP"]],                      // Balharshah-Gondia (chord itself)
  B107: [["MKP", "BPL"]],                                   // Maksi-Bhopal chord
  B108: [["RTM", "MKP"]],                                   // Ratlam-Maksi chord
};

module.exports = { STATIONS, EDGES, BLOCK_SEGMENTS };
