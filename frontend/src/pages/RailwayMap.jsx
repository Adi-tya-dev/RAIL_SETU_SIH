import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Activity, AlertTriangle, ChevronRight, Crosshair, Layers3, MapPinned, Search, TrainFront, X, ShieldAlert } from "lucide-react";
import { getTrain, listTrains } from "../api/trains.api";
import { listMaintenance } from "../api/maintenance.api";
import { listConflicts } from "../api/conflicts.api";
import { useApi, useApiQuery } from "../hooks/useApi";
import { DEPARTMENT_HEX, DEPARTMENT_LABEL, LEVEL_LABEL, SEVERITY_LABEL, SEVERITY_TONE, TRAIN_PRIORITY_HEX, TRAIN_PRIORITY_SHORT, statusTone } from "../utils/constants";
import { formatDateTime, humanize } from "../utils/formatters";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import Drawer from "../components/common/Drawer";
import MaintenanceDrawer from "../components/maintenance/MaintenanceDrawer";

const INDIA_BOUNDS = [[7.5, 68.2], [35, 97.2]];
const INDIA_CENTER = [22.5, 79.2];

// State + district boundaries are bundled locally (public/geo) - no tiles, no API key, offline-safe.
const STATES_GEOJSON = "/geo/india-states.geojson";
const DISTRICTS_GEOJSON = "/geo/india-districts.geojson";

const normalizeId = (value) => value === null || value === undefined ? "" : String(value);
const coordinate = (record) => {
  const lat = Number(record?.latitude);
  const lng = Number(record?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};
const orderedStations = (train) => [...(train?.train_routes || [])].sort((a, b) => Number(a.sequence_number || 0) - Number(b.sequence_number || 0));
const departmentColor = (department) => DEPARTMENT_HEX[String(department || "").toUpperCase()] || "#22c55e";
const mean = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
const hashSeed = (text) => { let hash = 0; const value = String(text); for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973; return hash; };
const priorityNumber = (train) => Number(train?.priority) > 0 ? Number(train.priority) : 3;
const priorityInfo = (train) => {
  const p = priorityNumber(train);
  return { p, short: TRAIN_PRIORITY_SHORT[p] || `P${p}`, hex: TRAIN_PRIORITY_HEX[p] || "#fbbf24" };
};
// Lower service-priority number = released first in a collision.
function releaseOrder(selectedTrain, otherTrain) {
  if (!selectedTrain || !otherTrain) return null;
  const a = priorityNumber(selectedTrain);
  const b = priorityNumber(otherTrain);
  if (a < b) return { first: selectedTrain, second: otherTrain, tie: false };
  if (b < a) return { first: otherTrain, second: selectedTrain, tie: false };
  return { first: selectedTrain, second: otherTrain, tie: true };
}

function distanceBetween([lat1, lon1], [lat2, lon2]) {
  const radius = 6371;
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function overlaps(startA, endA, startB, endB) {
  const values = [startA, endA, startB, endB].map((value) => new Date(value).getTime());
  return values.every(Number.isFinite) && values[0] < values[3] && values[1] > values[2];
}

function stationIcon(role, index, total, active) {
  const size = role === "bypassed" ? [22, 22] : role === "served" ? [18, 18] : role === "intermediate" ? [14, 14] : [28, 28];
  const anchor = role === "bypassed" ? [11, 11] : role === "served" ? [9, 9] : role === "intermediate" ? [7, 7] : [14, 14];
  return L.divIcon({
    className: "railway-station-icon-wrap",
    html: `<span class="railway-station-icon railway-station-icon--${role}${active ? " is-active" : ""}" data-stop="${index}" data-total="${total}"></span>`,
    iconSize: size,
    iconAnchor: anchor,
  });
}

function maintenanceIcon(department, critical) {
  const color = critical ? "#ef4444" : departmentColor(department);
  return L.divIcon({
    className: "railway-maint-icon-wrap",
    html: `<span class="railway-maint-icon${critical ? " railway-maint-icon--critical" : ""}" style="--maint:${color}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function NetworkStatusHud({ trains, activeBlocks, maintenance, conflicts }) {
  return (
    <div className="railway-map-hud">
      <div className="railway-map-hud__title"><Activity size={12} /> Network status</div>
      <div className="railway-map-hud__grid">
        <div className="railway-map-hud__metric"><b>{trains}</b><span>Trains</span></div>
        <div className="railway-map-hud__metric"><b>{activeBlocks}</b><span>Active blocks</span></div>
        <div className="railway-map-hud__metric"><b>{maintenance}</b><span>Maintenance</span></div>
        <div className="railway-map-hud__metric railway-map-hud__metric--conflicts"><b>{conflicts}</b><span>Conflicts</span></div>
      </div>
    </div>
  );
}

// Small directional particles flowing source -> destination along the selected route.
function RouteParticles({ path }) {
  const map = useMap();
  useEffect(() => {
    if (!path || path.length < 2) return undefined;
    const container = map.getContainer();
    const canvas = document.createElement("canvas");
    canvas.className = "railway-route-particles";
    container.appendChild(canvas);
    const context = canvas.getContext("2d");
    let projected = [];
    let segments = [];
    let totalLength = 0;
    const resize = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const project = () => {
      const zoom = map.getZoom();
      projected = path.map(([lat, lng]) => map.latLngToContainerPoint([lat, lng], zoom));
      segments = [];
      totalLength = 0;
      for (let i = 0; i < projected.length - 1; i += 1) {
        const dx = projected[i + 1].x - projected[i].x;
        const dy = projected[i + 1].y - projected[i].y;
        const length = Math.hypot(dx, dy);
        segments.push(length);
        totalLength += length;
      }
    };
    const reset = () => { resize(); project(); };
    const pointAt = (distance) => {
      if (!totalLength) return projected[0] || { x: 0, y: 0 };
      let target = distance % totalLength;
      for (let i = 0; i < segments.length; i += 1) {
        if (target <= segments[i]) {
          const t = segments[i] ? target / segments[i] : 0;
          return { x: projected[i].x + (projected[i + 1].x - projected[i].x) * t, y: projected[i].y + (projected[i + 1].y - projected[i].y) * t };
        }
        target -= segments[i];
      }
      return projected[projected.length - 1] || { x: 0, y: 0 };
    };
    map.on("move zoom resize", reset);
    reset();
    const count = 9;
    const duration = 6800;
    const start = performance.now();
    let frame;
    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      context.clearRect(0, 0, canvas.width, canvas.height);
      const time = (now - start) / duration;
      for (let i = 0; i < count; i += 1) {
        const phase = (time + i / count) % 1;
        const point = pointAt(phase * totalLength);
        const comet = pointAt(phase * totalLength + 16);
        const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 7);
        glow.addColorStop(0, "rgba(190,248,255,0.95)");
        glow.addColorStop(0.4, "rgba(34,211,238,0.42)");
        glow.addColorStop(1, "rgba(34,211,238,0)");
        context.beginPath();
        context.arc(point.x, point.y, 5.5, 0, Math.PI * 2);
        context.fillStyle = glow;
        context.fill();
        context.beginPath();
        context.strokeStyle = "rgba(140,242,255,0.5)";
        context.lineWidth = 1.3;
        context.lineCap = "round";
        context.moveTo(point.x, point.y);
        context.lineTo(comet.x, comet.y);
        context.stroke();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      map.off("move zoom resize", reset);
      canvas.remove();
    };
  }, [map, path]);
  return null;
}

// Keeps permanent station labels readable: collapses overlapping intermediate labels.
function StationLabelManager({ count }) {
  const map = useMap();
  const timer = useRef(0);
  useEffect(() => {
    const container = map.getContainer();
    const run = () => {
      const kept = [];
      [...container.querySelectorAll(".railway-station-tooltip")].forEach((element) => {
        element.dataset.collapsed = "";
        element.style.visibility = "";
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const collision = kept.some((k) => !(rect.right < k.left + 4 || rect.left > k.right - 4 || rect.bottom < k.top + 2 || rect.top > k.bottom - 2));
        if (collision && element.classList.contains("railway-station-tooltip--intermediate")) {
          element.classList.add("railway-station-tooltip--hidden");
          element.dataset.collapsed = "1";
          element.style.visibility = "hidden";
        } else {
          element.classList.remove("railway-station-tooltip--hidden");
          kept.push(rect);
        }
      });
    };
    const debounce = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(run, 60);
    };
    run();
    map.on("moveend zoomend resize", debounce);
    const observer = new MutationObserver(run);
    observer.observe(container, { childList: true, subtree: true });
    const frame = requestAnimationFrame(() => run());
    return () => {
      window.clearTimeout(timer.current);
      cancelAnimationFrame(frame);
      map.off("moveend zoomend resize", debounce);
      observer.disconnect();
    };
  }, [map, count]);
  return null;
}

function formatRouteTime(value) {
  if (!value) return "Schedule unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Schedule unavailable" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function delayMinutes(route) {
  if (!route.actual_arrival && !route.actual_departure) return null;
  const scheduled = route.scheduled_arrival || route.scheduled_departure;
  const actual = route.actual_arrival || route.actual_departure;
  const result = Math.round((new Date(actual).getTime() - new Date(scheduled).getTime()) / 60000);
  return Number.isFinite(result) ? result : null;
}

// Bow each corridor hop into a gentle arc so routes read as connected track corridors,
// not raw point-to-point chords. Geometry is derived from real station topology.
function arcPath(a, b, bend = 0.12) {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const length = Math.hypot(dLat, dLng) || 1e-6;
  const control = [(lat1 + lat2) / 2 - (dLng / length) * length * bend, (lng1 + lng2) / 2 + (dLat / length) * length * bend];
  const points = [];
  const steps = 18;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push([
      mt * mt * lat1 + 2 * mt * t * control[0] + t * t * lat2,
      mt * mt * lng1 + 2 * mt * t * control[1] + t * t * lng2,
    ]);
  }
  return points;
}

function corridorPath(points) {
  if (points.length < 2) return points;
  const path = [];
  points.slice(0, -1).forEach((point, index) => {
    const segment = arcPath(point, points[index + 1]);
    path.push(...(index === 0 ? segment : segment.slice(1)));
  });
  return path;
}

function pointAlongPath(points, fraction) {
  if (points.length === 1) return points[0];
  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = distanceBetween(points[i], points[i + 1]);
    segments.push(length);
    total += length;
  }
  if (!total) return points[0];
  let target = total * Math.min(1, Math.max(0, fraction));
  for (let i = 0; i < segments.length; i += 1) {
    if (target <= segments[i]) {
      const t = segments[i] ? target / segments[i] : 0;
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
    }
    target -= segments[i];
  }
  return points[points.length - 1];
}

function offsetPoint([lat, lng], seed, magnitude = 0.02) {
  const angle = ((seed % 360) * Math.PI) / 180;
  return [lat + Math.cos(angle) * magnitude, lng + Math.sin(angle) * magnitude * 0.85];
}

function nearestOnPath(point, path) {
  if (!point || !path?.length) return point;
  let best = path[0];
  let bestDistance = Infinity;
  path.forEach((candidate) => {
    const value = (candidate[0] - point[0]) ** 2 + (candidate[1] - point[1]) ** 2;
    if (value < bestDistance) {
      bestDistance = value;
      best = candidate;
    }
  });
  return best;
}

// Group real stations per section and order them by observed train-route sequence.
function buildSectionModel(networkTrains) {
  const stations = new Map();
  const order = new Map();
  networkTrains.forEach((train) => {
    orderedStations(train).forEach((route, index) => {
      const station = route.station;
      if (!station || !coordinate(station)) return;
      const id = normalizeId(station.station_id);
      if (!stations.has(id)) stations.set(id, station);
      if (!order.has(id)) order.set(id, []);
      const value = Number(route.sequence_number);
      order.get(id).push(Number.isFinite(value) ? value : index + 1);
    });
  });
  const grouped = new Map();
  stations.forEach((station, id) => {
    const sectionId = normalizeId(station.section_id);
    if (!sectionId) return;
    if (!grouped.has(sectionId)) grouped.set(sectionId, []);
    grouped.get(sectionId).push({ id, station, rank: mean(order.get(id) || []) });
  });
  const sections = new Map();
  grouped.forEach((list, sectionId) => {
    sections.set(sectionId, list.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)).map((entry) => entry.station));
  });
  return { sections };
}

// Locate a maintenance block along its section corridor using real chainage ratios.
function placeOnSection(sectionStations, section, block) {
  const points = (sectionStations || []).map((station) => coordinate(station)).filter(Boolean);
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  const start = Number(section?.start_chainage);
  const end = Number(section?.end_chainage);
  let fraction = 0.5;
  const blockStart = Number(block?.start_chainage);
  const blockEnd = Number(block?.end_chainage);
  if (Number.isFinite(blockStart) && Number.isFinite(blockEnd) && Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const mid = (blockStart + blockEnd) / 2;
    fraction = Math.min(0.94, Math.max(0.06, (mid - start) / (end - start)));
  }
  return pointAlongPath(points, fraction);
}

function MapViewport({ points, request, focus }) {
  const map = useMap();
  const lastRequest = useRef(0);
  const lastFocus = useRef(null);
  useEffect(() => {
    if (request === lastRequest.current) return;
    lastRequest.current = request;
    const india = request % 2 === 1;
    map.fitBounds(india || points.length < 2 ? INDIA_BOUNDS : points, { padding: [48, 48], maxZoom: india ? 5 : 8 });
  }, [map, points, request]);
  useEffect(() => {
    if (!focus || focus === lastFocus.current) return;
    lastFocus.current = focus;
    map.fitBounds(focus.bounds, { padding: [60, 60], maxZoom: 10 });
    focus.onDone?.();
  }, [map, focus]);
  return null;
}

function BoundaryLayers({ districts, states }) {
  const map = useMap();
  useEffect(() => {
    if (!districts && !states) return undefined;
    const layers = [];
    if (districts) {
      layers.push(L.geoJSON(districts, {
        renderer: L.canvas({ padding: 0.4 }),
        style: { color: "#1d3f58", weight: 0.4, opacity: 0.32, fillColor: "#0a1830", fillOpacity: 0.9 },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name;
          if (name) layer.bindTooltip(name, { sticky: true, direction: "top", className: "boundary-tooltip" });
        },
      }).addTo(map));
    }
    if (states) {
      layers.push(L.geoJSON(states, {
        style: { color: "#2c5a7c", weight: 0.8, opacity: 0.5, fillColor: "#123455", fillOpacity: 0.06 },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name;
          if (name) layer.bindTooltip(name, { permanent: true, direction: "center", className: "boundary-label" });
        },
      }).addTo(map));
    }
    return () => layers.forEach((layer) => map.removeLayer(layer));
  }, [map, districts, states]);
  return null;
}

function Metric({ label, value, tone }) {
  return <div className={`railway-map-metric railway-map-metric--${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function LayerToggle({ checked, color, label, onChange }) {
  return <label className="railway-layer-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="railway-layer-toggle__swatch" style={{ background: color }} /><span>{label}</span></label>;
}

function routeStopState(route, index, total) {
  const now = Date.now();
  const delay = delayMinutes(route);
  if (delay !== null) {
    if (delay <= 5) return "ontime";
    if (delay < 15) return "minor";
    return "late";
  }
  const departure = route.scheduled_departure ? new Date(route.scheduled_departure).getTime() : null;
  const arrival = route.scheduled_arrival ? new Date(route.scheduled_arrival).getTime() : null;
  const bound = index === total - 1 ? arrival : departure;
  if (bound !== null && now > bound + 5 * 60000) return "passed";
  return "upcoming";
}

function RouteTimeline({ stations, activeKey, onSelect }) {
  const listRef = useRef(null);
  const activeRef = useRef(null);
  const firstFuture = stations.findIndex((route, index) => routeStopState(route, index, stations.length) !== "passed");
  const currentIndex = firstFuture === -1 ? Math.max(stations.length - 1, 0) : firstFuture;
  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeKey, stations]);
  return (
    <section className="railway-map-route-summary">
      <div className="railway-map-route-summary__head">
        <div className="railway-map-section-title"><Crosshair size={15} /> Route timeline</div>
        <span className="railway-map-route-count">{stations.length} stops</span>
      </div>
      <div className="railway-map-route-list" ref={listRef}>
        {stations.length ? stations.map((route, index) => {
          const isDestination = index === stations.length - 1;
          const state = index === currentIndex ? "current" : routeStopState(route, index, stations.length);
          const active = normalizeId(route.station?.station_id) === activeKey;
          const delay = delayMinutes(route);
          return (
            <button type="button" key={route.train_route_id || index} onClick={() => onSelect(route, index)} ref={active ? activeRef : undefined} className={`railway-map-route-stop railstop-${state}${active ? " is-active" : ""}`}>
              <span className="railway-map-route-stop__node" />
              <span className="railway-map-route-stop__body">
                <span className="railway-map-route-stop__code">{route.station?.station_code || "-"}{isDestination && (<em>Destination</em>)}</span>
                <span className="railway-map-route-stop__name">{route.station?.station_name || "Unknown station"}</span>
                <span className="railway-map-route-stop__times">
                  {route.scheduled_arrival && (<span>Arr <b>{formatRouteTime(route.scheduled_arrival)}</b></span>)}
                  <span>Dep <b>{route.scheduled_departure ? formatRouteTime(route.scheduled_departure) : "-"}</b></span>
                  {route.actual_departure && (<span>Act <b>{formatRouteTime(route.actual_departure)}</b></span>)}
                  {delay !== null && (<span className={`railway-map-route-stop__delay ${delay > 5 ? (delay < 15 ? "is-minor" : "is-late") : "is-ok"}`}>{delay > 0 ? `+${delay}m` : "On time"}</span>)}
                </span>
              </span>
            </button>
          );
        }) : <span className="railway-map-muted">No ordered stations available.</span>}
      </div>
    </section>
  );
}

function ReleaseOrder({ selectedTrain, otherTrain }) {
  const order = releaseOrder(selectedTrain, otherTrain);
  if (!order) return null;
  const first = priorityInfo(order.first);
  const second = priorityInfo(order.second);
  return (
    <span className="railway-release-order">
      <span className="railway-release-order__dot" style={{ background: order.tie ? "#fbbf24" : first.hex }} />
      {order.tie ? (
        <span>Equal priority <b>P{first.p}</b> - release by scheduled (first-come) basis</span>
      ) : (
        <span>
          Release <b style={{ color: first.hex }}>{order.first.train_number} ({first.short})</b> first, then{" "}
          <b>{order.second.train_number} ({second.short})</b>
        </span>
      )}
    </span>
  );
}

export default function RailwayMap() {
  const trainsQuery = useApiQuery(useCallback(() => listTrains({ limit: 100 }), []), []);
  const networkQuery = useApiQuery(useCallback(async () => Promise.all((trainsQuery.data?.data || []).map((train) => getTrain(train.train_id).then((response) => response?.data || response))), [trainsQuery.data?.data]), [trainsQuery.data?.data?.map((train) => train.train_id).join(",") || ""]);
  const maintenanceQuery = useApiQuery(useCallback(() => listMaintenance({ limit: 100 }), []), []);
  const conflictsQuery = useApiQuery(useCallback(() => listConflicts({ limit: 100 }), []), []);
  const detailQuery = useApi();
  const [search, setSearch] = useState("");
  const [trainId, setTrainId] = useState("");
  const [viewportRequest, setViewportRequest] = useState(1);
  const [station, setStation] = useState(null);
  const [maintenanceTask, setMaintenanceTask] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [layers, setLayers] = useState({ route: true, stations: true, engineering: true, traction: true, signalling: true, critical: true, blocks: false, conflicts: true });
  const [boundaries, setBoundaries] = useState({ districts: null, states: null });
  const [focusBounds, setFocusBounds] = useState(null);
  const [activeStationKey, setActiveStationKey] = useState("");

  const [emergencyReroute, setEmergencyReroute] = useState(() => {
    const hash = window.location.hash || "";
    if (!hash.includes("?")) return null;
    const params = new URLSearchParams(hash.split("?")[1]);
    const trainId = params.get("trainId");
    const trainNumber = params.get("trainNumber");
    const block = params.get("block");
    const strategy = params.get("strategy") || "SLW";
    const strategyName = params.get("strategyName") || strategy;
    const bypassed = new Set((params.get("bypassed") || "").split(",").filter(Boolean));
    const served = new Set((params.get("served") || "").split(",").filter(Boolean));
    if (trainId || trainNumber || block) {
      return { trainId, trainNumber, block, strategy, strategyName, bypassed, served };
    }
    return null;
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(DISTRICTS_GEOJSON).then((response) => (response.ok ? response.json() : null)).catch(() => null),
      fetch(STATES_GEOJSON).then((response) => (response.ok ? response.json() : null)).catch(() => null),
    ]).then(([districts, states]) => { if (active) setBoundaries({ districts, states }); });
    return () => { active = false; };
  }, []);

  const trains = trainsQuery.data?.data || [];
  const networkTrains = networkQuery.data || [];
  const maintenance = maintenanceQuery.data?.data || [];
  const conflicts = conflictsQuery.data?.data || [];
  const selectedTrain = detailQuery.data?.data ?? detailQuery.data;
  const selectedTrainId = normalizeId(selectedTrain?.train_id || trainId);

  const filteredTrains = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query ? trains.filter((train) => `${train.train_number} ${train.train_name}`.toLowerCase().includes(query)) : trains;
    return [...list].sort((a, b) => Number(a.train_number) - Number(b.train_number));
  }, [search, trains]);

  const routeStations = useMemo(() => orderedStations(selectedTrain), [selectedTrain]);
  const routePoints = useMemo(() => routeStations.map((route) => coordinate(route.station)).filter(Boolean), [routeStations]);
  const routePath = useMemo(() => corridorPath(routePoints), [routePoints]);
  const routeDistance = useMemo(() => routePoints.slice(1).reduce((total, point, index) => total + distanceBetween(routePoints[index], point), 0), [routePoints]);
  const routeMaxDelay = useMemo(() => {
    const delays = routeStations.map(delayMinutes).filter((value) => value !== null);
    return delays.length ? Math.max(...delays) : null;
  }, [routeStations]);
  const routeGlowWeight = routeDistance > 1200 ? 16 : 12;
  const routeSectionIds = useMemo(() => new Set(routeStations.map((route) => normalizeId(route.station?.section_id)).filter(Boolean)), [routeStations]);
  const movementBlockIds = useMemo(() => new Set((selectedTrain?.train_block_movements || []).map((movement) => normalizeId(movement.block_id))), [selectedTrain]);

  const networkRoutes = useMemo(() => networkTrains
    .map((train) => ({ train, stations: orderedStations(train) }))
    .map(({ train, stations }) => ({ train, points: stations.map((route) => coordinate(route.station)).filter(Boolean) }))
    .filter(({ points }) => points.length > 1)
    .map(({ train, points }) => ({ train, path: corridorPath(points) })), [networkTrains]);

  const networkStations = useMemo(() => {
    const nodes = new Map();
    const edges = new Set();
    networkTrains.forEach((train) => {
      const stations = orderedStations(train);
      stations.forEach((route) => {
        const station = route.station;
        const point = coordinate(station);
        if (!station || !point) return;
        const id = normalizeId(station.station_id);
        if (!nodes.has(id)) nodes.set(id, { id, point, degree: 0 });
      });
      for (let i = 0; i < stations.length - 1; i += 1) {
        const a = stations[i].station;
        const b = stations[i + 1].station;
        if (!a || !b) continue;
        const key = [normalizeId(a.station_id), normalizeId(b.station_id)].sort().join("|");
        if (edges.has(key)) continue;
        edges.add(key);
        if (nodes.has(normalizeId(a.station_id))) nodes.get(normalizeId(a.station_id)).degree += 1;
        if (nodes.has(normalizeId(b.station_id))) nodes.get(normalizeId(b.station_id)).degree += 1;
      }
    });
    return [...nodes.values()];
  }, [networkTrains]);

  const sectionModel = useMemo(() => buildSectionModel(networkTrains), [networkTrains]);
  const maintenanceLocations = useMemo(() => maintenance.map((task) => {
    const sectionId = normalizeId(task.section_id || task.section?.section_id);
    const stations = sectionModel.sections.get(sectionId) || [];
    const base = placeOnSection(stations, task.section, task.block);
    const point = base ? offsetPoint(base, hashSeed(`loc-${task.maintenance_task_id}`), 0.02) : null;
    return { task, point, sectionId, blockId: normalizeId(task.block_id) };
  }), [maintenance, sectionModel]);

  const relevantMaintenance = useMemo(() => {
    if (!selectedTrain) return [];
    return maintenanceLocations.map((item) => {
      const relation = movementBlockIds.has(item.blockId) ? "ON TRAIN ROUTE" : routeSectionIds.has(item.sectionId) ? "NEAR TRAIN ROUTE" : null;
      if (!relation) return null;
      const snapped = relation === "ON TRAIN ROUTE" && routePath.length > 1 ? nearestOnPath(item.point, routePath) : item.point;
      const point = snapped ? offsetPoint(snapped, hashSeed(`snap-${item.task.maintenance_task_id}`), 0.012) : null;
      return { ...item, point, relation };
    }).filter(Boolean);
  }, [maintenanceLocations, movementBlockIds, routeSectionIds, selectedTrain, routePath]);

  const overviewMaintenance = useMemo(() => maintenanceLocations.filter((item) => item.point), [maintenanceLocations]);
  const storedConflicts = useMemo(() => (conflicts || []).filter((item) => normalizeId(item.train_id) === selectedTrainId || normalizeId(item.train?.train_id) === selectedTrainId), [conflicts, selectedTrainId]);
  const derivedConflicts = useMemo(() => {
    if (!selectedTrain) return [];
    const own = selectedTrain.train_block_movements || [];
    const others = networkTrains.flatMap((train) => (train.train_block_movements || []).filter((movement) => normalizeId(train.train_id) !== selectedTrainId).map((movement) => ({ ...movement, train })));
    const trainConflicts = own.flatMap((movement) => others.filter((other) => normalizeId(other.block_id) === normalizeId(movement.block_id) && overlaps(movement.scheduled_entry, movement.scheduled_exit, other.scheduled_entry, other.scheduled_exit)).map((other) => ({ conflict_id: `movement-${movement.movement_id}-${other.movement_id}`, conflict_type: "TRAIN_TRAIN_MOVEMENT", severity: 3, description: `${selectedTrain.train_number} overlaps ${other.train.train_number} on ${movement.block?.block_code || "the same block"}.`, train: other.train, block: movement.block })));
    const maintenanceConflicts = relevantMaintenance.flatMap(({ task }) => own.filter((movement) => normalizeId(movement.block_id) === normalizeId(task.block_id) && task.preferred_start && overlaps(movement.scheduled_entry, movement.scheduled_exit, task.preferred_start, new Date(new Date(task.preferred_start).getTime() + Number(task.duration_minutes || 0) * 60000))).map((movement) => ({ conflict_id: `maintenance-${task.maintenance_task_id}-${movement.movement_id}`, conflict_type: "TRAIN_MAINTENANCE", severity: Number(task.criticality) >= 4 ? 4 : 3, description: `${selectedTrain.train_number} overlaps ${task.maintenance_type} on ${movement.block?.block_code || "the same block"}.`, train: selectedTrain, block: movement.block, maintenance_task: task })));
    return [...trainConflicts, ...maintenanceConflicts];
  }, [networkTrains, relevantMaintenance, selectedTrain, selectedTrainId]);
  const trainConflicts = [...storedConflicts, ...derivedConflicts];
  const affectedBlocks = (selectedTrain?.train_block_movements || []).filter((movement) => movement.block);
  const routeUnavailableReason = selectedTrain && routeStations.length === 0 ? "No ordered train route records were returned." : selectedTrain && routePoints.length < 2 ? "Route stations exist, but fewer than two stations have coordinates." : null;
  const maintenanceMarkers = selectedTrain ? relevantMaintenance : overviewMaintenance;
  const hudTrains = trains.length;
  const hudBlocks = selectedTrain && affectedBlocks ? affectedBlocks.length : networkTrains.reduce((total, train) => total + (train.train_block_movements || []).length, 0);
  const hudMaintenance = selectedTrain ? relevantMaintenance.length : overviewMaintenance.length;
  const hudConflicts = selectedTrain ? trainConflicts.length : conflicts.length;

  useEffect(() => { if (routePoints.length > 1) setViewportRequest((value) => (value % 2 === 0 ? value + 2 : value + 1)); }, [selectedTrainId, routePoints.length]);
  const fitIndia = () => setViewportRequest((value) => (value % 2 === 1 ? value + 2 : value + 1));
  const fitRoute = () => setViewportRequest((value) => (value % 2 === 0 ? value + 2 : value + 1));

  function selectTrain(nextId) {
    setTrainId(nextId);
    setStation(null);
    setConflict(null);
    setActiveStationKey("");
    if (nextId) detailQuery.run(() => getTrain(nextId));
    else detailQuery.reset();
  }

  // Auto-select train when navigated from Emergency Rerouting link
  useEffect(() => {
    if (!emergencyReroute) return;
    if (emergencyReroute.trainId) {
      selectTrain(emergencyReroute.trainId);
    } else if (emergencyReroute.trainNumber && trains.length > 0) {
      const match = trains.find((t) => String(t.train_number) === String(emergencyReroute.trainNumber));
      if (match) selectTrain(match.train_id);
    }
  }, [emergencyReroute, trains]);

  const rerouteSlwPath = useMemo(() => {
    if (!emergencyReroute || routePoints.length < 2) return [];
    const offset = routePoints.map(([lat, lng]) => [lat + 0.015, lng + 0.015]);
    return corridorPath(offset);
  }, [emergencyReroute, routePoints]);

  const rerouteChordPath = useMemo(() => {
    if (!emergencyReroute || routePoints.length < 2 || emergencyReroute.strategy !== "CHORD_BYPASS") return [];
    const start = routePoints[0];
    const end = routePoints[routePoints.length - 1];
    return arcPath(start, end, 0.28);
  }, [emergencyReroute, routePoints]);

  const blockedLocation = useMemo(() => {
    if (!emergencyReroute) return null;
    const taskOnBlock = maintenanceLocations.find((m) => m.task?.block?.block_code === emergencyReroute.block);
    if (taskOnBlock?.point) return taskOnBlock.point;
    if (routePoints.length >= 2) {
      return routePoints[Math.floor(routePoints.length / 2)];
    }
    return null;
  }, [emergencyReroute, maintenanceLocations, routePoints]);

  function selectStation(route, focusMap = true) {
    setStation(route);
    const key = normalizeId(route?.station?.station_id);
    setActiveStationKey(key);
    if (!focusMap) return;
    const point = coordinate(route?.station);
    const pad = point ? 0.07 : 0.5;
    const center = point || [INDIA_CENTER[0], INDIA_CENTER[1]];
    const bounds = point ? [[center[0] - pad, center[1] - pad], [center[0] + pad, center[1] + pad]] : INDIA_BOUNDS;
    setFocusBounds({ bounds, token: Date.now() });
  }

  function toggleLayer(key, value) {
    setLayers((current) => ({ ...current, [key]: value }));
  }

  function focusConflict(item) {
    setConflict(item);
    const blockId = normalizeId(item?.block_id || item?.block?.block_id || item?.movement?.block_id);
    const task = maintenance.find((entry) => normalizeId(entry.block_id) === blockId || normalizeId(entry.block?.block_id) === blockId);
    const sectionId = normalizeId(task?.section_id || task?.section?.section_id);
    const stations = (sectionModel.sections.get(sectionId) || []).map(coordinate).filter(Boolean);
    if (!stations.length) return;
    const bounds = stations.length > 1 ? stations : [[stations[0][0] - 0.05, stations[0][1] - 0.05], [stations[0][0] + 0.05, stations[0][1] + 0.05]];
    setFocusBounds({ bounds, token: Date.now() });
  }

  return (
    <div className="railway-map-page">
      <aside className="railway-map-sidebar">
        <div className="railway-map-sidebar__top">
          <div className="railway-map-eyebrow"><MapPinned size={14} /> Network view</div>
          <h1>Railway Network Map</h1>
          <p>India-focused train routes, infrastructure and operational impact.</p>
        </div>
        <div className="railway-map-control">
          <label className="railway-map-label" htmlFor="train-search">Select train</label>
          <div className="railway-map-search">
            <Search size={16} />
            <input id="train-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number or name" />
            <button type="button" onClick={() => setSearch("")} aria-label="Clear train search"><X size={14} /></button>
          </div>
          <select className="select railway-map-train-select" value={trainId} onChange={(event) => selectTrain(event.target.value)} aria-label="Select train">
            <option value="">Select a train</option>
            {filteredTrains.map((train) => <option key={train.train_id} value={train.train_id}>{train.train_number} - {train.train_name}</option>)}
          </select>
        </div>
        {trainId && detailQuery.loading && <div className="railway-map-inline-state"><span className="spinner spinner--xs" /> Loading train route...</div>}
        {detailQuery.error && (
          <div className="railway-map-alert railway-map-alert--error">
            <strong>Unable to load train route.</strong>
            <span>{detailQuery.error.message}</span>
            <Button size="sm" onClick={() => detailQuery.run(() => getTrain(trainId))}>Retry</Button>
          </div>
        )}
        {!selectedTrain && !detailQuery.loading && !detailQuery.error && (
          <div className="railway-map-empty">
            <div className="railway-map-empty__icon"><TrainFront size={22} /></div>
            <strong>India railway network</strong>
            <p>Select a train to highlight its route and operational impact.</p>
          </div>
        )}
        {selectedTrain && (
          <>
            <section className="railway-map-train-card">
              <div className="railway-map-train-card__top">
                <span>TRAIN {selectedTrain.train_number}</span>
                <Badge tone={statusTone(selectedTrain.status)} dot>{humanize(selectedTrain.status)}</Badge>
              </div>
              <h2>{selectedTrain.train_name}</h2>
              <p>{selectedTrain.origin_station?.station_name || "-"} <ChevronRight size={14} /> {selectedTrain.destination_station?.station_name || "-"}</p>
              <div className="railway-map-train-card__meta">
                <span>Priority <b style={{ color: priorityInfo(selectedTrain).hex }}>{priorityInfo(selectedTrain).short}</b><small className="railway-priority-desc">{selectedTrain.train_type || ""}</small></span>
                <span>Distance <b>{routeDistance ? `${Math.round(routeDistance)} km` : "-"}</b></span>
              </div>
            </section>
            {routeUnavailableReason && <div className="railway-map-alert"><strong>Route data unavailable</strong><span>{routeUnavailableReason}</span></div>}
            <section className="railway-map-impact">
              <div className="railway-map-section-title"><Activity size={15} /> Network impact</div>
              <div className="railway-map-metrics">
                <Metric label="Blocks" value={affectedBlocks.length} tone="blue" />
                <Metric label="Maintenance" value={relevantMaintenance.length} tone="amber" />
                <Metric label="Conflicts" value={trainConflicts.length} tone={trainConflicts.length ? "red" : "green"} />
                <Metric label="Delay min" value={routeMaxDelay !== null ? (routeMaxDelay > 15 ? `+${routeMaxDelay}` : routeMaxDelay > 5 ? `+${routeMaxDelay}` : routeMaxDelay > 0 ? `+${routeMaxDelay}` : "0") : "-"} tone={routeMaxDelay === null ? "violet" : routeMaxDelay > 15 ? "red" : routeMaxDelay > 5 ? "red" : routeMaxDelay > 0 ? "amber" : "green"} />
              </div>
            </section>
            <RouteTimeline stations={routeStations} activeKey={activeStationKey} onSelect={(route) => selectStation(route, true)} />
          </>
        )}
        {selectedTrain && trainConflicts.length > 0 && (
          <section className="railway-map-records">
            <div className="railway-map-section-title"><AlertTriangle size={15} /> Conflicts</div>
            {trainConflicts.map((item, index) => (
              <button type="button" className="railway-map-record railway-map-record--button" key={item.conflict_id || index} onClick={() => focusConflict(item)}>
                <span><b>{humanize(item.conflict_type)}</b><small>{item.block?.block_code || "Block unavailable"}</small></span>
                <Badge tone={SEVERITY_TONE[item.severity] || "red"}>{SEVERITY_LABEL[item.severity] || "Conflict"}</Badge>
                {selectedTrain && item.train && selectedTrain.train_id !== item.train.train_id && (
                  <ReleaseOrder selectedTrain={selectedTrain} otherTrain={item.train} />
                )}
              </button>
            ))}
          </section>
        )}
        <section className="railway-map-layers">
          <div className="railway-map-section-title"><Layers3 size={15} /> Map layers</div>
          <LayerToggle checked={layers.route} color="#22d3ee" label="Train route" onChange={(value) => toggleLayer("route", value)} />
          <LayerToggle checked={layers.stations} color="#dff7ff" label="Stations" onChange={(value) => toggleLayer("stations", value)} />
          <LayerToggle checked={layers.engineering} color={DEPARTMENT_HEX.ENGINEERING} label="Engineering" onChange={(value) => toggleLayer("engineering", value)} />
          <LayerToggle checked={layers.traction} color={DEPARTMENT_HEX.TRACTION} label="Traction" onChange={(value) => toggleLayer("traction", value)} />
          <LayerToggle checked={layers.signalling} color={DEPARTMENT_HEX.SIGNAL} label="Signalling" onChange={(value) => toggleLayer("signalling", value)} />
          <LayerToggle checked={layers.critical} color="#ef4444" label="Critical assets" onChange={(value) => toggleLayer("critical", value)} />
          <LayerToggle checked={layers.blocks} color="#f59e0b" label="Affected blocks" onChange={(value) => toggleLayer("blocks", value)} />
          <LayerToggle checked={layers.conflicts} color="#ef4444" label="Conflicts" onChange={(value) => toggleLayer("conflicts", value)} />
        </section>
      </aside>
      <main className="railway-map-canvas">
        <div className="railway-map-toolbar">
          <div>
            <span className="railway-map-toolbar__kicker">RAILSETU / LIVE NETWORK</span>
            <strong>{selectedTrain ? `${selectedTrain.train_number} - ${selectedTrain.train_name}` : "India network overview"}</strong>
          </div>
          <div className="railway-map-toolbar__actions">
            <Button variant="secondary" size="sm" onClick={fitIndia}>Fit India</Button>
            <Button variant="primary" size="sm" disabled={routePoints.length < 2} onClick={fitRoute}>Fit train route</Button>
          </div>
        </div>
        <div className="railway-map-map-shell">
          <MapContainer center={INDIA_CENTER} bounds={INDIA_BOUNDS} maxBounds={[[4, 64], [38, 101]]} maxBoundsViscosity={0.55} minZoom={4} maxZoom={13} zoom={5} zoomAnimation style={{ height: "100%", width: "100%" }}>
            <BoundaryLayers districts={boundaries.districts} states={boundaries.states} />
            <MapViewport points={routePoints} request={viewportRequest} focus={focusBounds ? { bounds: focusBounds.bounds, onDone: () => setFocusBounds(null) } : null} />
            <StationLabelManager count={routeStations.length} />
            {networkRoutes.map(({ train, path }) => {
              const isSelected = selectedTrainId === normalizeId(train.train_id);
              const trainSelected = Boolean(selectedTrain);
              const baseColor = isSelected ? "#16384d" : "#24506d";
              const baseWeight = isSelected ? 1 : 1.25;
              const baseOpacity = isSelected ? 0.28 : trainSelected ? 0.32 : 0.5;
              const key = `network-${train.train_id}`;
              return (
                <Polyline
                  key={key}
                  positions={path}
                  className="railway-route-network"
                  pathOptions={{ color: baseColor, weight: baseWeight, opacity: baseOpacity, smoothFactor: 0 }}
                  eventHandlers={{
                    mouseover: (event) => {
                      event.target.setStyle({ color: "#3f7fae", weight: 1.8, opacity: 0.9 });
                      if (event.target.getElement()) event.target.getElement().style.cursor = "pointer";
                    },
                    mouseout: (event) => { event.target.setStyle({ color: baseColor, weight: baseWeight, opacity: baseOpacity }); },
                  }}
                >
                  <Tooltip className="railway-network-tooltip">{train.train_number} - {train.train_name}{isSelected ? " (selected)" : ""}</Tooltip>
                </Polyline>
              );
            })}
            {layers.stations && networkStations.map((node) => (
              <CircleMarker
                key={`junction-${node.id}`}
                center={node.point}
                radius={node.degree >= 3 ? 3 : 2}
                pathOptions={{ color: "#33546e", weight: 0.8, fillColor: node.degree >= 3 ? "#6f9db8" : "#4f7a95", fillOpacity: 0.8 }}
              />
            ))}
            {layers.route && routePath.length > 1 && (
              <>
                {emergencyReroute ? (
                  <>
                    {/* 1. Original Scheduled Route (Dashed slate) */}
                    <Polyline
                      positions={routePath}
                      pathOptions={{ color: "#94a3b8", weight: 3.5, dashArray: "6, 8", opacity: 0.8, smoothFactor: 0 }}
                    >
                      <Tooltip className="railway-network-tooltip">Scheduled Route ({selectedTrain?.train_number} Original Track)</Tooltip>
                    </Polyline>

                    {/* 2. Rerouted Diversion Path */}
                    {emergencyReroute.strategy === "CHORD_BYPASS" && rerouteChordPath.length > 1 ? (
                      <>
                        <Polyline positions={rerouteChordPath} className="railway-route-glow" pathOptions={{ color: "#f59e0b", weight: routeGlowWeight, opacity: 0.25, smoothFactor: 0 }} />
                        <Polyline positions={rerouteChordPath} className="railway-route-core" pathOptions={{ color: "#f59e0b", weight: 5, dashArray: "10, 6", opacity: 1, smoothFactor: 0 }} />
                        <RouteParticles path={rerouteChordPath} />
                      </>
                    ) : (
                      <>
                        <Polyline positions={rerouteSlwPath.length > 1 ? rerouteSlwPath : routePath} className="railway-route-glow" pathOptions={{ color: "#22c55e", weight: routeGlowWeight, opacity: 0.25, smoothFactor: 0 }} />
                        <Polyline positions={rerouteSlwPath.length > 1 ? rerouteSlwPath : routePath} className="railway-route-core" pathOptions={{ color: "#22c55e", weight: 5, opacity: 1, smoothFactor: 0 }} />
                        <RouteParticles path={rerouteSlwPath.length > 1 ? rerouteSlwPath : routePath} />
                      </>
                    )}

                    {/* 3. Blocked Sector Marker */}
                    {blockedLocation && (
                      <Marker
                        position={blockedLocation}
                        icon={L.divIcon({
                          className: "railway-station-icon-wrap",
                          html: `<span class="railway-station-icon railway-station-icon--bypassed" style="width:26px;height:26px;"></span>`,
                          iconSize: [26, 26],
                          iconAnchor: [13, 13],
                        })}
                      >
                        <Tooltip permanent direction="top" className="railway-station-tooltip--bypassed">
                          🛑 BLOCKED: {emergencyReroute.block} (Emergency Track Possession)
                        </Tooltip>
                        <Popup>
                          <strong style={{ color: "#ef4444" }}>EMERGENCY TRACK BLOCK: {emergencyReroute.block}</strong><br />
                          All traffic stopped or diverted.<br />
                          Reroute Mode: <strong>{emergencyReroute.strategyName}</strong>
                        </Popup>
                      </Marker>
                    )}
                  </>
                ) : (
                  <>
                    <Polyline positions={routePath} className="railway-route-glow" pathOptions={{ color: "#22d3ee", weight: routeGlowWeight, opacity: 0.16, smoothFactor: 0 }} />
                    <Polyline positions={routePath} className="railway-route-core" pathOptions={{ color: "#22d3ee", weight: 5, opacity: 1, smoothFactor: 0 }} />
                    <RouteParticles path={routePath} />
                  </>
                )}
              </>
            )}
            {layers.stations && routeStations.map((route, index) => {
              const point = coordinate(route.station);
              const code = route.station?.station_code;
              let role = index === 0 ? "source" : index === routeStations.length - 1 ? "destination" : "intermediate";
              const isBypassed = emergencyReroute?.bypassed?.has(code);
              const isServed = emergencyReroute?.served?.has(code);
              if (isBypassed) role = "bypassed";
              else if (isServed) role = "served";

              if (!point) return null;
              const direction = role === "source" ? "right" : role === "destination" ? "left" : index % 2 === 0 ? "right" : "top";
              const active = normalizeId(route.station?.station_id) === activeStationKey;
              return (
                <Marker key={route.train_route_id || index} position={point} icon={stationIcon(role, index, routeStations.length, active)} eventHandlers={{
                  click: () => selectStation(route, false),
                  mouseover: (event) => {
                    const element = event.target.getTooltip?.()?.getElement?.();
                    if (element && element.dataset.collapsed === "1") element.style.visibility = "visible";
                  },
                  mouseout: (event) => {
                    const element = event.target.getTooltip?.()?.getElement?.();
                    if (element && element.dataset.collapsed === "1") element.style.visibility = "hidden";
                  },
                }}>
                  <Tooltip permanent offset={direction === "top" ? [0, -15] : [10, 0]} direction={direction} className={`railway-station-tooltip railway-station-tooltip--${role}`}>
                    {isBypassed ? `⚠ ${route.station?.station_name || code} (BYPASSED)` : isServed ? `✓ ${route.station?.station_name || code}` : (route.station?.station_name || route.station?.station_code || "Station")}
                  </Tooltip>
                  <Popup>
                    <strong>{route.station?.station_name}</strong><br />
                    {code || "-"} - Stop {index + 1} of {routeStations.length}<br />
                    {isBypassed ? (
                      <div style={{ color: "#ef4444", marginTop: 4 }}>
                        <strong>⚠ Commercial Stoppage Bypassed</strong><br />
                        <span style={{ fontSize: 11, color: "#f59e0b" }}>Passengers cannot board here. Bus bridging deployed.</span>
                      </div>
                    ) : isServed ? (
                      <div style={{ color: "#22c55e", marginTop: 4 }}>
                        <strong>✓ Commercial Stoppage Preserved</strong><br />
                        <span style={{ fontSize: 11, color: "#86efac" }}>Boarding maintained on parallel/diverted path.</span>
                      </div>
                    ) : null}
                  </Popup>
                </Marker>
              );
            })}
            {maintenanceMarkers.map(({ task, point, relation }) => {
              const department = String(task.department || "").toUpperCase();
              const enabled = department === "ENGINEERING" ? layers.engineering : department === "TRACTION" ? layers.traction : department === "SIGNAL" ? layers.signalling : true;
              const critical = Number(task.criticality) >= 4;
              if (!point || !enabled || (critical && !layers.critical)) return null;
              return (
                <Marker key={task.maintenance_task_id} position={point} icon={maintenanceIcon(department, critical)} eventHandlers={{ click: () => setMaintenanceTask(task) }}>
                  <Tooltip className="railway-maint-tooltip">
                    <strong>{task.asset?.asset_code || `Task ${task.maintenance_task_id}`}</strong> - {DEPARTMENT_LABEL[department] || department}{relation ? ` - ${relation.toLowerCase()}` : ""}
                  </Tooltip>
                  <Popup>
                    <strong>{task.asset?.asset_code || `Task ${task.maintenance_task_id}`}</strong><br />
                    {DEPARTMENT_LABEL[department] || department}<br />
                    {relation || "Network maintenance location"}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          {emergencyReroute && (
            <div className="railway-map-emergency-hud">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ShieldAlert size={22} color="#ef4444" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#fca5a5" }}>
                    🚨 Emergency Diversion Active on Block {emergencyReroute.block}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    Train {selectedTrain?.train_number} ({selectedTrain?.train_name}) — Strategy: <strong>{emergencyReroute.strategyName}</strong>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: "#4ade80", fontWeight: 600, fontSize: 12 }}>
                  ✓ {emergencyReroute.served.size} Stoppages Preserved
                </span>
                {emergencyReroute.bypassed.size > 0 && (
                  <span style={{ color: "#f87171", fontWeight: 600, fontSize: 12 }}>
                    ⚠ {emergencyReroute.bypassed.size} Bypassed (Bus Bridge Alert)
                  </span>
                )}
                <button
                  onClick={() => {
                    setEmergencyReroute(null);
                    window.location.hash = "/map";
                  }}
                  className="railway-map-emergency-hud__close"
                >
                  ✕ Return to Standard Network
                </button>
              </div>
            </div>
          )}
          <div className="railway-map-canvas-empty">
            {!selectedTrain && (
              <>
                <div className="railway-map-canvas-empty__icon"><TrainFront size={28} /></div>
                <strong>INDIA NETWORK OVERVIEW</strong>
                <span>{networkRoutes.length} connected corridors - {overviewMaintenance.length} mapped maintenance locations</span>
              </>
            )}
          </div>
          <NetworkStatusHud trains={hudTrains} activeBlocks={hudBlocks} maintenance={hudMaintenance} conflicts={hudConflicts} />
          <div className="railway-map-legend">
            <strong>Legend</strong>
            <span><i className="railway-map-legend-line" />Selected route</span>
            <span><i className="railway-map-legend-line railway-map-legend-line--dim" />Railway corridor</span>
            <span><i className="railway-map-legend-dot railway-map-legend-dot--source" />Source</span>
            <span><i className="railway-map-legend-dot railway-map-legend-dot--destination" />Destination</span>
            <span><i className="railway-map-legend-dot railway-map-legend-dot--station" />Station</span>
            <span><i className="railway-map-legend-dot railway-map-legend-dot--engineering" />Engineering</span>
            <span><i className="railway-map-legend-dot railway-map-legend-dot--traction" />Traction</span>
            <span><i className="railway-map-legend-dot railway-map-legend-dot--signalling" />Signalling</span>
            <span><i className="railway-map-legend-dot railway-map-legend-dot--critical" />Critical / conflict</span>
            {emergencyReroute && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <span><i className="railway-map-legend-line" style={{ background: "#94a3b8" }} />Original scheduled path</span>
                <span><i className="railway-map-legend-line" style={{ background: emergencyReroute.strategy === "CHORD_BYPASS" ? "#f59e0b" : "#22c55e" }} />Rerouted trajectory</span>
                <span><i className="railway-map-legend-dot" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />Preserved stop</span>
                <span><i className="railway-map-legend-dot" style={{ background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />Bypassed / skipped stop</span>
              </>
            )}
          </div>
        </div>
        {selectedTrain && (
          <div className="railway-map-statusbar">
            <span><b>{routePoints.length}</b> station coordinates</span>
            <span><b>{routeDistance ? Math.round(routeDistance) : 0}</b> km route length</span>
            <span><b>{relevantMaintenance.filter((item) => item.point).length}</b> mapped maintenance</span>
          </div>
        )}
      </main>
      <Drawer open={Boolean(station)} onClose={() => setStation(null)} title={station?.station?.station_name || "Station details"} subtitle={station?.station?.station_code || "Route station"}>
        {station && (
          <div className="railway-map-drawer-content">
            <Badge tone="blue">Route stop {station.sequence_number}</Badge>
            <div className="detail-list">
              <div><span>Station code</span><strong>{station.station?.station_code || "-"}</strong></div>
              <div><span>Stop order</span><strong>{station.sequence_number} of {routeStations.length}</strong></div>
              <div><span>Arrival</span><strong>{formatDateTime(station.scheduled_arrival)}</strong></div>
              <div><span>Departure</span><strong>{formatDateTime(station.scheduled_departure)}</strong></div>
              {station.actual_departure && <div><span>Actual departure</span><strong>{formatDateTime(station.actual_departure)}</strong></div>}
              {delayMinutes(station) !== null && <div><span>Delay</span><strong className={delayMinutes(station) > 5 ? "has-error" : "text-muted"}>{delayMinutes(station) > 0 ? `+${delayMinutes(station)} min` : "On time"}</strong></div>}
            </div>
          </div>
        )}
      </Drawer>
      <MaintenanceDrawer task={maintenanceTask} onClose={() => setMaintenanceTask(null)} />
      <Drawer open={Boolean(conflict)} onClose={() => setConflict(null)} title="Conflict details" subtitle={conflict ? `Plan ${conflict.plan_id || "Derived overlap"}` : ""}>
        {conflict && (
          <div className="railway-map-drawer-content">
            <Badge tone={SEVERITY_TONE[conflict.severity] || "red"}>{SEVERITY_LABEL[conflict.severity] || "Conflict"}</Badge>
            <p className="text-muted">{conflict.description}</p>
            {selectedTrain && conflict.train && selectedTrain.train_id !== conflict.train.train_id && (
              <div className="railway-map-drawer-release">
                <div className="railway-map-section-title"><TrainFront size={15} /> Release order</div>
                <ReleaseOrder selectedTrain={selectedTrain} otherTrain={conflict.train} />
                <div className="railway-tree">
                  <div className="railway-tree__row">
                    <span className="railway-tree__col"><i style={{ background: priorityInfo(selectedTrain).hex }} /> {selectedTrain.train_number}</span>
                    <span>{priorityInfo(selectedTrain).short} · {selectedTrain.train_type || ""}</span>
                    <span className="railway-tree__dir">{selectedTrain.origin_station?.station_code || "-"} → {selectedTrain.destination_station?.station_code || "-"}</span>
                  </div>
                  <div className="railway-tree__row">
                    <span className="railway-tree__col"><i style={{ background: priorityInfo(conflict.train).hex }} /> {conflict.train.train_number}</span>
                    <span>{priorityInfo(conflict.train).short} · {conflict.train.train_type || ""}</span>
                    <span className="railway-tree__dir">{conflict.train.origin_station?.station_code || "-"} → {conflict.train.destination_station?.station_code || "-"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
