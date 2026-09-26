import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Activity, AlertTriangle, ChevronRight, Crosshair, Layers3, MapPinned, Search, TrainFront, X, ShieldAlert, ChevronDown, ChevronUp, Minus } from "lucide-react";
import { getTrain, listTrains } from "../api/trains.api";
import { listMaintenance } from "../api/maintenance.api";
import { listConflicts, detectConflicts } from "../api/conflicts.api";
import { useApi, useApiQuery } from "../hooks/useApi";
import { DEPARTMENT_HEX, DEPARTMENT_LABEL, LEVEL_LABEL, SEVERITY_LABEL, SEVERITY_TONE, TRAIN_PRIORITY_HEX, TRAIN_PRIORITY_SHORT, statusTone } from "../utils/constants";
import { formatDateTime, humanize } from "../utils/formatters";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import Drawer from "../components/common/Drawer";
import MaintenanceDrawer from "../components/maintenance/MaintenanceDrawer";
import { DetailSection, DetailList } from "../components/common/DetailList";
import { navigate, useRoute } from "../hooks/useRoute";
import { STATIONS, EDGES, resolveBypassRoute, resolveTrackGeometry } from "../data/railwayNetwork";

const INDIA_BOUNDS = [[7.5, 68.0], [37.2, 97.4]];
const INDIA_CENTER = [22.35, 82.7];

// State + district boundaries are bundled locally (public/geo) - no tiles, no API key, offline-safe.
const STATES_GEOJSON = "/geo/india-states.geojson";
const DISTRICTS_GEOJSON = "/geo/india-districts.geojson";

const normalizeId = (value) => value === null || value === undefined ? "" : String(value);
const coordinate = (record) => {
  const code = record?.station_code || record?.code;
  if (code && STATIONS[code] && Number.isFinite(STATIONS[code].lat) && Number.isFinite(STATIONS[code].lng)) {
    return [STATIONS[code].lat, STATIONS[code].lng];
  }
  const lat = Number(record?.latitude ?? record?.lat);
  const lng = Number(record?.longitude ?? record?.lng);
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

function conflictIcon(severity, count) {
  const size = severity >= 5 ? 14 : severity >= 4 ? 12 : 10;
  const anchor = Math.round(size / 2);
  const color = severity >= 5 ? "#ef4444" : severity >= 4 ? "#f97316" : severity >= 3 ? "#f59e0b" : "#eab308";
  return L.divIcon({
    className: "railway-conflict-icon-wrap",
    html: `<span class="railway-conflict-dot" style="--conflict:${color};--sz:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
}

function NetworkStatusHud({
  trains,
  activeBlocks,
  maintenance,
  conflicts,
  layers,
  onToggleLayer,
  isMinimized,
  onToggleMinimize,
  selectedTrain,
}) {
  if (isMinimized) {
    return (
      <div
        className="railway-map-hud railway-map-hud--minimized"
        onClick={() => onToggleMinimize(false)}
        title="Click to expand Network Status"
        role="button"
        tabIndex={0}
      >
        <div className="railway-map-hud__title" style={{ margin: 0, justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={12} color="#67e8f9" />
            <span>Network status</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span style={{ color: "#94a3b8" }}>
              <span
                onClick={(e) => { e.stopPropagation(); navigate("/trains"); }}
                style={{ cursor: "pointer", textDecoration: "underline" }}
                title="Go to Trains page"
              >
                {trains}T
              </span>{" "}·{" "}
              <span
                onClick={(e) => { e.stopPropagation(); navigate("/blocks"); }}
                style={{ cursor: "pointer", textDecoration: "underline" }}
                title="Go to Blocks page"
              >
                {activeBlocks}B
              </span>{" "}·{" "}
              <span
                onClick={(e) => { e.stopPropagation(); navigate("/maintenance"); }}
                style={{ cursor: "pointer", textDecoration: "underline" }}
                title="Go to Maintenance Tasks page"
              >
                {maintenance}M
              </span>{" "}·{" "}
              <b
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedTrain) {
                    navigate(`/conflicts?trainNumber=${selectedTrain.train_number}&trainName=${encodeURIComponent(selectedTrain.train_name || "")}&trainId=${selectedTrain.train_id}`);
                  } else {
                    navigate("/conflicts");
                  }
                }}
                style={{ color: "#f87171", cursor: "pointer", textDecoration: "underline" }}
                title={selectedTrain ? `View conflicts for Train ${selectedTrain.train_number}` : "Go to Conflicts page"}
              >
                {conflicts}C
              </b>
            </span>
            <ChevronUp size={14} style={{ color: "#67e8f9" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="railway-map-hud">
      <div className="railway-map-hud__title">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Activity size={12} color="#67e8f9" />
          <span>Network status</span>
        </div>
        <button
          type="button"
          className="railway-map-hud__btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMinimize(true);
          }}
          title="Minimize Network Status to dock"
          aria-label="Minimize Network Status"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="railway-map-hud__grid">
        <button
          type="button"
          className="railway-map-hud__metric"
          onClick={() => navigate("/trains")}
          title="Click to view all Trains page"
        >
          <b>{trains}</b>
          <span>Trains ↗</span>
        </button>
        <button
          type="button"
          className="railway-map-hud__metric"
          onClick={() => navigate("/blocks")}
          title="Click to view all Active Blocks page"
        >
          <b>{activeBlocks}</b>
          <span>Active blocks ↗</span>
        </button>
        <button
          type="button"
          className="railway-map-hud__metric"
          onClick={() => navigate("/maintenance")}
          title="Click to view Maintenance Tasks page"
        >
          <b>{maintenance}</b>
          <span>Maintenance ↗</span>
        </button>
        <button
          type="button"
          className="railway-map-hud__metric railway-map-hud__metric--conflicts"
          onClick={() => {
            if (selectedTrain) {
              navigate(`/conflicts?trainNumber=${selectedTrain.train_number}&trainName=${encodeURIComponent(selectedTrain.train_name || "")}&trainId=${selectedTrain.train_id}`);
            } else {
              navigate("/conflicts");
            }
          }}
          title={selectedTrain ? `Click to view ${conflicts} conflict(s) for Train ${selectedTrain.train_number} in Conflict Analysis` : "Click to view Conflicts & Alerts page"}
        >
          <b>{conflicts}</b>
          <span>Conflicts ↗</span>
        </button>
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

// Centripetal Catmull-Rom spline interpolation (alpha = 0.5).
// Creates a seamless, C1-continuous curved railway path through all station coordinates
// without straight-line chords, cusps, or self-intersections.
function catmullRomSpline(points, baseSteps = 24) {
  if (!points || points.length < 2) return points || [];
  if (points.length === 2) {
    const [p0, p1] = points;
    const dLat = p1[0] - p0[0];
    const dLng = p1[1] - p0[1];
    const len = Math.hypot(dLat, dLng) || 1e-6;
    const bend = 0.04;
    const ctrl = [
      (p0[0] + p1[0]) / 2 - (dLng / len) * len * bend,
      (p0[1] + p1[1]) / 2 + (dLat / len) * len * bend,
    ];
    const res = [];
    for (let i = 0; i <= baseSteps; i += 1) {
      const t = i / baseSteps;
      const mt = 1 - t;
      res.push([
        mt * mt * p0[0] + 2 * mt * t * ctrl[0] + t * t * p1[0],
        mt * mt * p0[1] + 2 * mt * t * ctrl[1] + t * t * p1[1],
      ]);
    }
    return res;
  }

  // Extend with virtual endpoints for natural boundary tangents
  const extended = [
    [points[0][0] - (points[1][0] - points[0][0]) * 0.5, points[0][1] - (points[1][1] - points[0][1]) * 0.5],
    ...points,
    [
      points[points.length - 1][0] + (points[points.length - 1][0] - points[points.length - 2][0]) * 0.5,
      points[points.length - 1][1] + (points[points.length - 1][1] - points[points.length - 2][1]) * 0.5,
    ],
  ];

  const result = [];
  const alpha = 0.5; // Centripetal parameter prevents loops and overshoots

  for (let i = 0; i < extended.length - 3; i += 1) {
    const p0 = extended[i];
    const p1 = extended[i + 1];
    const p2 = extended[i + 2];
    const p3 = extended[i + 3];

    const d1 = Math.pow(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), alpha) || 1e-4;
    const d2 = Math.pow(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), alpha) || 1e-4;
    const d3 = Math.pow(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]), alpha) || 1e-4;

    const t0 = 0;
    const t1 = t0 + d1;
    const t2 = t1 + d2;
    const t3 = t2 + d3;

    // Adapt sample steps based on geographic distance for uniform smoothness
    const segDist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const numSteps = Math.max(baseSteps, Math.round(segDist * 8));

    for (let step = (i === 0 ? 0 : 1); step <= numSteps; step += 1) {
      const t = t1 + (t2 - t1) * (step / numSteps);

      const fA1_0 = (t1 - t) / (t1 - t0);
      const fA1_1 = (t - t0) / (t1 - t0);
      const a1_0 = fA1_0 * p0[0] + fA1_1 * p1[0];
      const a1_1 = fA1_0 * p0[1] + fA1_1 * p1[1];

      const fA2_0 = (t2 - t) / (t2 - t1);
      const fA2_1 = (t - t1) / (t2 - t1);
      const a2_0 = fA2_0 * p1[0] + fA2_1 * p2[0];
      const a2_1 = fA2_0 * p1[1] + fA2_1 * p2[1];

      const fA3_0 = (t3 - t) / (t3 - t2);
      const fA3_1 = (t - t2) / (t3 - t2);
      const a3_0 = fA3_0 * p2[0] + fA3_1 * p3[0];
      const a3_1 = fA3_0 * p2[1] + fA3_1 * p3[1];

      const fB1_0 = (t2 - t) / (t2 - t0);
      const fB1_1 = (t - t0) / (t2 - t0);
      const b1_0 = fB1_0 * a1_0 + fB1_1 * a2_0;
      const b1_1 = fB1_0 * a1_1 + fB1_1 * a2_1;

      const fB2_0 = (t3 - t) / (t3 - t1);
      const fB2_1 = (t - t1) / (t3 - t1);
      const b2_0 = fB2_0 * a2_0 + fB2_1 * a3_0;
      const b2_1 = fB2_0 * a2_1 + fB2_1 * a3_1;

      const fC_0 = (t2 - t) / (t2 - t1);
      const fC_1 = (t - t1) / (t2 - t1);
      const c_0 = fC_0 * b1_0 + fC_1 * b2_0;
      const c_1 = fC_0 * b1_1 + fC_1 * b2_1;

      result.push([Number(c_0.toFixed(5)), Number(c_1.toFixed(5))]);
    }
  }

  return result;
}

function corridorPath(points) {
  if (!points || points.length < 2) return points || [];
  return catmullRomSpline(points, 24);
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

function segmentAlongPath(points, startFrac, endFrac) {
  if (!points || points.length < 2) return [];
  const sFrac = Math.min(startFrac, endFrac);
  const eFrac = Math.max(startFrac, endFrac);
  const pStart = pointAlongPath(points, sFrac);
  const pEnd = pointAlongPath(points, eFrac);
  if (!pStart || !pEnd) return [];

  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = distanceBetween(points[i], points[i + 1]);
    segments.push(length);
    total += length;
  }
  if (!total) return [pStart, pEnd];

  const targetStart = total * sFrac;
  const targetEnd = total * eFrac;
  const subPoints = [pStart];

  let currentDist = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const nextDist = currentDist + segments[i];
    if (currentDist > targetStart && currentDist < targetEnd) {
      subPoints.push(points[i]);
    }
    currentDist = nextDist;
  }
  subPoints.push(pEnd);
  return subPoints;
}

function offsetPoint([lat, lng], seed, magnitude = 0.003) {
  const angle = ((seed % 360) * Math.PI) / 180;
  return [lat + Math.cos(angle) * magnitude, lng + Math.sin(angle) * magnitude * 0.85];
}

function nearestOnPath(point, path) {
  if (!point || !Array.isArray(point) || !path?.length) return point || null;
  let best = path[0];
  let bestDistance = Infinity;
  path.forEach((candidate) => {
    if (!candidate || !Array.isArray(candidate)) return;
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
// When multiple tasks exist on the same block, distribute them cleanly along the block span.
function placeOnSection(sectionStations, section, block, taskIndex = 0, totalTasks = 1) {
  const points = (sectionStations || []).map((station) => coordinate(station)).filter(Boolean);
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  const start = Number(section?.start_chainage);
  const end = Number(section?.end_chainage);
  let fraction = 0.5;
  const blockStart = Number(block?.start_chainage);
  const blockEnd = Number(block?.end_chainage);
  if (Number.isFinite(blockStart) && Number.isFinite(blockEnd) && Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const blockSpan = Math.max(blockEnd - blockStart, 1);
    const stepFraction = totalTasks > 1 ? (taskIndex + 1) / (totalTasks + 1) : 0.5;
    const taskKm = blockStart + blockSpan * (0.15 + 0.7 * stepFraction);
    fraction = Math.min(0.96, Math.max(0.04, (taskKm - start) / (end - start)));
  }
  return pointAlongPath(points, fraction);
}

// Compute the exact sub-segment polyline of the track spanning just the blocked/conflicted section/block
function blockTrackSegment(sectionStations, section, block, fallbackPoint, routePoints) {
  const trainPath = Array.isArray(routePoints) && routePoints.length >= 2 ? routePoints : null;

  if (trainPath && fallbackPoint && Array.isArray(fallbackPoint)) {
    // Locate the point on this train's actual route closest to the conflict point
    const nearest = nearestOnPath(fallbackPoint, trainPath);
    if (nearest && Array.isArray(nearest)) {
      // Find index of closest coordinate on train's route
      let nearestIdx = -1;
      let minDistance = Infinity;
      for (let i = 0; i < trainPath.length; i++) {
        const p = trainPath[i];
        if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
          const d = Math.hypot(p[0] - nearest[0], p[1] - nearest[1]);
          if (d < minDistance) {
            minDistance = d;
            nearestIdx = i;
          }
        }
      }

      if (nearestIdx >= 0) {
        // Take a small, clean segment strictly along this train's route (never jumping across states)
        const span = Math.max(1, Math.min(3, Math.floor(trainPath.length * 0.02)));
        const sIdx = Math.max(0, nearestIdx - span);
        const eIdx = Math.min(trainPath.length - 1, nearestIdx + span);
        if (eIdx > sIdx) {
          return trainPath.slice(sIdx, eIdx + 1);
        }
      }
    }
  }

  // Fallback: If not on route, render a clean small localized segment around the conflict point (max 3km)
  if (fallbackPoint && Array.isArray(fallbackPoint) && Number.isFinite(fallbackPoint[0]) && Number.isFinite(fallbackPoint[1])) {
    return [
      [fallbackPoint[0] - 0.025, fallbackPoint[1] - 0.025],
      fallbackPoint,
      [fallbackPoint[0] + 0.025, fallbackPoint[1] + 0.025],
    ];
  }

  return null;
}

function ResponsiveMapController({ isTrainSelected, points }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === "undefined") return undefined;

    let resizeTimer = null;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;

        map.invalidateSize({ pan: false, debounceMoveEvents: true });

        // If no specific train route is active, auto-fit India cleanly to container
        if (!isTrainSelected || points.length < 2) {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            const pad = width < 600 || height < 500 ? [14, 14] : [24, 24];
            map.fitBounds(INDIA_BOUNDS, { padding: pad, animate: false });
          }, 100);
        }
      }
    });

    observer.observe(container);
    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [map, isTrainSelected, points]);

  return null;
}

function MapViewport({ points, request, focus }) {
  const map = useMap();
  const lastRequest = useRef(0);
  const lastFocus = useRef(null);
  useEffect(() => {
    if (request === lastRequest.current) return;
    lastRequest.current = request;
    const india = request % 2 === 1;
    const size = map.getSize();
    const pad = size.x < 600 || size.y < 500 ? [14, 14] : [24, 24];
    map.fitBounds(india || points.length < 2 ? INDIA_BOUNDS : points, { padding: pad, maxZoom: india ? 6 : 9, animate: true });
  }, [map, points, request]);
  useEffect(() => {
    if (!focus || focus === lastFocus.current) return;
    lastFocus.current = focus;
    map.fitBounds(focus.bounds, { padding: [48, 48], maxZoom: 10, animate: true });
    focus.onDone?.();
  }, [map, focus]);
  return null;
}

const STATE_LABELS = [
  // Northern Region
  { id: "ladakh", name: "LADAKH", lat: 34.40, lng: 77.60 },
  { id: "jk", name: "JAMMU &\nKASHMIR", lat: 33.65, lng: 74.85 },
  { id: "hp", name: "HIMACHAL\nPRADESH", lat: 31.90, lng: 77.15 },
  { id: "pb", name: "PUNJAB", lat: 30.85, lng: 75.35 },
  { id: "hr", name: "HARYANA", lat: 29.15, lng: 76.05 },
  { id: "uk", name: "UTTARAKHAND", lat: 30.15, lng: 79.20 },
  { id: "rj", name: "RAJASTHAN", lat: 26.50, lng: 73.60 },

  // Central Region
  { id: "up", name: "UTTAR PRADESH", lat: 27.10, lng: 80.80 },
  { id: "mp", name: "MADHYA PRADESH", lat: 23.40, lng: 77.50 },
  { id: "cg", name: "CHHATTISGARH", lat: 21.20, lng: 81.85 },

  // Western Region
  { id: "gj", name: "GUJARAT", lat: 22.70, lng: 71.50 },
  { id: "mh", name: "MAHARASHTRA", lat: 19.30, lng: 75.90 },
  { id: "ga", name: "GOA", lat: 15.35, lng: 73.80, minZoom: 5.2 },

  // Eastern Region
  { id: "br", name: "BIHAR", lat: 25.70, lng: 85.70 },
  { id: "jh", name: "JHARKHAND", lat: 23.65, lng: 85.50 },
  { id: "or", name: "ODISHA", lat: 20.45, lng: 84.40 },
  { id: "wb", name: "WEST BENGAL", lat: 23.20, lng: 87.80 },
  { id: "sk", name: "SIKKIM", lat: 27.65, lng: 88.50, minZoom: 5.2 },

  // North-Eastern Region
  { id: "as", name: "ASSAM", lat: 26.25, lng: 92.80 },
  { id: "ml", name: "MEGHALAYA", lat: 25.45, lng: 91.30 },
  { id: "ar", name: "ARUNACHAL PRADESH", lat: 28.15, lng: 94.60 },
  { id: "nl", name: "NAGALAND", lat: 26.10, lng: 94.45 },
  { id: "mn", name: "MANIPUR", lat: 24.80, lng: 93.90 },
  { id: "mz", name: "MIZORAM", lat: 23.20, lng: 92.85 },
  { id: "tr", name: "TRIPURA", lat: 23.75, lng: 91.75, minZoom: 5.2 },

  // Southern Region
  { id: "tg", name: "TELANGANA", lat: 17.80, lng: 79.00 },
  { id: "ap", name: "ANDHRA PRADESH", lat: 15.50, lng: 79.80 },
  { id: "ka", name: "KARNATAKA", lat: 14.65, lng: 75.80 },
  { id: "kl", name: "KERALA", lat: 10.35, lng: 76.40, rotate: -72 },
  { id: "tn", name: "TAMIL NADU", lat: 11.00, lng: 78.40 },
];

function BoundaryLayers({ districts, states }) {
  const map = useMap();
  useEffect(() => {
    if (!districts && !states) return undefined;
    const layers = [];

    // Dedicated custom pane for state labels to render cleanly above dark district fill
    // and below station markers and route glows
    let pane = map.getPane("stateLabelsPane");
    if (!pane) {
      pane = map.createPane("stateLabelsPane");
      pane.style.zIndex = "450";
      pane.style.pointerEvents = "none";
    }

    // Dynamic responsive & zoom-based scaling system
    const updateResponsiveScale = () => {
      if (!pane) return;
      const zoom = map.getZoom();
      const size = map.getSize();
      const minDimension = Math.min(size.x || 1000, size.y || 800);

      // Proportional container scale factor (responsive map size)
      // Small map (< 650px): ~0.72 - 0.85
      // Medium map (650px - 1000px): ~0.85 - 1.05
      // Large map (> 1000px): ~1.05 - 1.20
      const containerScale = Math.min(1.2, Math.max(0.72, minDimension / 800));

      // Dynamic zoom-based font size:
      // Zoom 4 (zoomed out): ~9.5px
      // Zoom 5 (normal overview): ~12.0px
      // Zoom 6 (regional): ~14.5px
      // Zoom 7+ (detailed): ~17.5px - 20px
      const baseFontSize = Math.max(8.0, Math.min(20.0, 9.5 + (zoom - 4) * 2.5));
      const responsiveFontSize = Math.max(7.0, Math.min(19.0, baseFontSize * containerScale));

      // Proportional letter-spacing
      const letterSpacing = Math.max(0.04, Math.min(0.10, (0.05 + (zoom - 4) * 0.015) * containerScale));

      pane.style.setProperty("--state-label-size", `${responsiveFontSize.toFixed(1)}px`);
      pane.style.setProperty("--state-label-spacing", `${letterSpacing.toFixed(3)}em`);

      // Collision handling: hide tiny states at small zoom or compact map
      const isSmallView = zoom < 4.8 || (zoom <= 5.0 && minDimension < 650);
      pane.classList.toggle("state-labels-pane--zoomed-out", isSmallView);
      pane.classList.toggle("state-labels-pane--deep-zoom", zoom >= 8);
    };

    map.on("zoom zoomend resize viewreset", updateResponsiveScale);
    let resizeObserver = null;
    try {
      const container = map.getContainer();
      if (container && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => updateResponsiveScale());
        resizeObserver.observe(container);
      }
    } catch {
      // Fallback
    }
    updateResponsiveScale();

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
      }).addTo(map));

      // Cartographic state labels placed at exact coordinates matching reference map
      const labelGroup = L.layerGroup();
      STATE_LABELS.forEach((label) => {
        const rotateTransform = label.rotate ? `rotate(${label.rotate}deg)` : "";
        const inlineTransform = `transform: translate(-50%, -50%) ${rotateTransform};`;
        const minZoomClass = label.minZoom ? "state-label--minzoom-5" : "";
        const textHtml = `<span class="state-label__text">${label.name.replace(/\n/g, "<br/>")}</span>`;

        const icon = L.divIcon({
          className: `custom-state-label-marker ${minZoomClass}`,
          html: `<div class="state-label ${minZoomClass}" style="${inlineTransform}">${textHtml}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([label.lat, label.lng], {
          icon,
          interactive: false,
          pane: "stateLabelsPane",
        });
        labelGroup.addLayer(marker);
      });
      labelGroup.addTo(map);
      layers.push(labelGroup);
    }
    return () => {
      map.off("zoom zoomend resize viewreset", updateResponsiveScale);
      if (resizeObserver) resizeObserver.disconnect();
      layers.forEach((layer) => map.removeLayer(layer));
    };
  }, [map, districts, states]);
  return null;
}

function Metric({ label, value, tone = "default", onClick, title }) {
  return (
    <div
      className={`railway-map-metric railway-map-metric--${tone}${onClick ? " is-clickable" : ""}`}
      onClick={onClick}
      title={title}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
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
  const conflictsQuery = useApiQuery(useCallback(() => listConflicts({ limit: 500 }), []), []);
  const detailQuery = useApi();
  const selectedTrain = detailQuery.data?.data ?? detailQuery.data;
  const trainConflictsQuery = useApiQuery(
    useCallback(() => {
      const tNum = selectedTrain?.train_number;
      if (!tNum) return Promise.resolve({ data: [] });
      return listConflicts({ trainNumber: tNum, limit: 100 });
    }, [selectedTrain?.train_number]),
    [selectedTrain?.train_number]
  );
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

  const currentRoute = useRoute();
  const queryParams = useMemo(() => {
    const qIndex = currentRoute.indexOf("?");
    return qIndex >= 0 ? new URLSearchParams(currentRoute.slice(qIndex + 1)) : new URLSearchParams();
  }, [currentRoute]);

  const [emergencyReroute, setEmergencyReroute] = useState(null);

  useEffect(() => {
    const hasStrategy = queryParams.has("strategy");
    const isEmergency = queryParams.get("emergency") === "true" || hasStrategy;
    if (isEmergency) {
      const tId = queryParams.get("trainId");
      const tNum = queryParams.get("trainNumber");
      const blk = queryParams.get("block");
      const strategy = queryParams.get("strategy") || "SLW";
      const strategyName = queryParams.get("strategyName") || strategy;
      const bypassed = new Set((queryParams.get("bypassed") || "").split(",").filter(Boolean));
      const served = new Set((queryParams.get("served") || "").split(",").filter(Boolean));
      const bypassPathStr = queryParams.get("bypassPath") || "";
      const bypassPath = bypassPathStr ? bypassPathStr.split(",").filter(Boolean) : null;
      setEmergencyReroute({ trainId: tId, trainNumber: tNum, block: blk, strategy, strategyName, bypassed, served, bypassPath });
      setIsEmergencyHudDismissed(false);
      setIsEmergencyHudMinimized(false);
    } else {
      setEmergencyReroute(null);
    }
  }, [queryParams]);

  const [isEmergencyHudMinimized, setIsEmergencyHudMinimized] = useState(false);
  const [isEmergencyHudDismissed, setIsEmergencyHudDismissed] = useState(false);
  const [isNetworkHudMinimized, setIsNetworkHudMinimized] = useState(false);
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);

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
  const selectedTrainId = normalizeId(selectedTrain?.train_id || trainId);
  const selectedRoute = selectedTrain;
  const showNetworkOverview = !selectedTrain && !selectedTrainId && !selectedRoute;

  const filteredTrains = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query ? trains.filter((train) => `${train.train_number} ${train.train_name}`.toLowerCase().includes(query)) : trains;
    return [...list].sort((a, b) => Number(a.train_number) - Number(b.train_number));
  }, [search, trains]);

  const routeStations = useMemo(() => orderedStations(selectedTrain), [selectedTrain]);

  // Construct train route strictly along the existing physical railway track geometry
  const routeTrackGeometry = useMemo(() => {
    return resolveTrackGeometry(routeStations);
  }, [routeStations]);

  const routePath = useMemo(() => {
    if (routeTrackGeometry.path.length > 1) {
      return routeTrackGeometry.path;
    }
    return routeStations.map((route) => coordinate(route.station)).filter(Boolean);
  }, [routeTrackGeometry, routeStations]);

  const routePoints = useMemo(() => {
    return routePath.length > 0
      ? routePath
      : routeStations.map((route) => coordinate(route.station)).filter(Boolean);
  }, [routePath, routeStations]);
  const routeDistance = useMemo(() => routePoints.slice(1).reduce((total, point, index) => total + distanceBetween(routePoints[index], point), 0), [routePoints]);
  const routeMaxDelay = useMemo(() => {
    const delays = routeStations.map(delayMinutes).filter((value) => value !== null);
    return delays.length ? Math.max(...delays) : null;
  }, [routeStations]);
  const routeGlowWeight = routeDistance > 1200 ? 16 : 12;
  const routeSectionIds = useMemo(() => new Set(routeStations.map((route) => normalizeId(route.station?.section_id)).filter(Boolean)), [routeStations]);
  const movementBlockIds = useMemo(() => new Set((selectedTrain?.train_block_movements || []).map((movement) => normalizeId(movement.block_id))), [selectedTrain]);

  // All permanent physical railway track corridors across India
  const physicalTracks = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const [from, to, dist, speed, type] of EDGES) {
      const pairKey = [from, to].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const s1 = STATIONS[from];
      const s2 = STATIONS[to];
      if (!s1 || !s2 || !s1.lat || !s2.lat) continue;

      list.push({
        key: `phys-track-${pairKey}`,
        from,
        to,
        fromName: s1.name,
        toName: s2.name,
        dist,
        speed,
        type,
        positions: [
          [s1.lat, s1.lng],
          [s2.lat, s2.lng],
        ],
      });
    }
    return list;
  }, []);

  const networkRoutes = useMemo(() => networkTrains
    .map((train) => {
      const stations = orderedStations(train);
      const geo = resolveTrackGeometry(stations);
      const path = geo.path.length > 1
        ? geo.path
        : stations.map((route) => coordinate(route.station)).filter(Boolean);
      return { train, path };
    })
    .filter(({ path }) => path.length > 1), [networkTrains]);

  const networkStations = useMemo(() => {
    const nodes = new Map();
    const edges = new Set();

    // 1. Stations from active trains
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

    // 2. Stations from permanent physical track infrastructure
    for (const [from, to] of EDGES) {
      const sA = STATIONS[from];
      const sB = STATIONS[to];
      if (sA && sA.lat && sA.lng && !nodes.has(from)) {
        nodes.set(from, { id: from, point: [sA.lat, sA.lng], degree: 0 });
      }
      if (sB && sB.lat && sB.lng && !nodes.has(to)) {
        nodes.set(to, { id: to, point: [sB.lat, sB.lng], degree: 0 });
      }
      const k = [from, to].sort().join("|");
      if (!edges.has(k)) {
        edges.add(k);
        if (nodes.has(from)) nodes.get(from).degree += 1;
        if (nodes.has(to)) nodes.get(to).degree += 1;
      }
    }

    return [...nodes.values()];
  }, [networkTrains]);

  const sectionModel = useMemo(() => buildSectionModel(networkTrains), [networkTrains]);
  const maintenanceLocations = useMemo(() => {
    const blockCounts = new Map();
    maintenance.forEach((task) => {
      const bId = normalizeId(task.block_id || task.block?.block_id);
      blockCounts.set(bId, (blockCounts.get(bId) || 0) + 1);
    });
    const blockSeen = new Map();

    return maintenance.map((task) => {
      const sectionId = normalizeId(task.section_id || task.section?.section_id);
      const blockId = normalizeId(task.block_id || task.block?.block_id);
      const totalInBlock = blockCounts.get(blockId) || 1;
      const taskIndex = blockSeen.get(blockId) || 0;
      blockSeen.set(blockId, taskIndex + 1);

      const stations = sectionModel.sections.get(sectionId) || [];
      const base = placeOnSection(stations, task.section, task.block, taskIndex, totalInBlock);
      const point = base ? offsetPoint(base, hashSeed(`loc-${task.maintenance_task_id}`), 0.003) : null;
      return { task, point, sectionId, blockId, taskIndex, totalInBlock };
    });
  }, [maintenance, sectionModel]);

  const relevantMaintenance = useMemo(() => {
    if (!selectedTrain) return [];
    const isEmergency = Boolean(emergencyReroute);
    const emergencyBlockCode = emergencyReroute?.block ? normalizeId(emergencyReroute.block) : null;

    // 1. Filter candidates relevant to train or emergency block
    const candidates = maintenanceLocations.filter((item) => {
      const isEmergencyBlock = emergencyBlockCode && (
        normalizeId(item.task?.block?.block_code) === emergencyBlockCode ||
        normalizeId(item.task?.block_id) === emergencyBlockCode ||
        item.blockId === emergencyBlockCode
      );
      const isOnRoute = movementBlockIds.has(item.blockId) || isEmergencyBlock;

      if (isEmergency && !isOnRoute) return false;

      const relation = isOnRoute
        ? (isEmergencyBlock ? "BLOCKED SECTOR" : "ON TRAIN ROUTE")
        : routeSectionIds.has(item.sectionId)
        ? "NEAR TRAIN ROUTE"
        : null;

      if (!relation) return false;
      return true;
    });

    // 2. Deduplicate repetitive test/simulator entries on the same block
    // Keep highest criticality unique task per (blockId + department + maintenance_type)
    const seenMap = new Map();
    candidates.forEach((item) => {
      const dept = String(item.task.department || "").toUpperCase();
      const type = String(item.task.maintenance_type || item.task.title || "").toUpperCase();
      const key = `${item.blockId}-${dept}-${type}`;
      if (!seenMap.has(key)) {
        seenMap.set(key, item);
      } else {
        const existing = seenMap.get(key);
        if (Number(item.task.criticality || 0) > Number(existing.task.criticality || 0)) {
          seenMap.set(key, item);
        }
      }
    });

    const uniqueCandidates = [...seenMap.values()];

    // 3. Group by block to space them out gracefully along the track corridor
    const blockGroups = new Map();
    uniqueCandidates.forEach((item) => {
      if (!blockGroups.has(item.blockId)) blockGroups.set(item.blockId, []);
      blockGroups.get(item.blockId).push(item);
    });

    const result = [];
    blockGroups.forEach((items, bId) => {
      const isEmergencyBlock = emergencyBlockCode && (
        normalizeId(items[0]?.task?.block?.block_code) === emergencyBlockCode ||
        items[0]?.blockId === emergencyBlockCode
      );
      const isOnRoute = movementBlockIds.has(bId) || isEmergencyBlock;
      const relation = isOnRoute
        ? (isEmergencyBlock ? "BLOCKED SECTOR" : "ON TRAIN ROUTE")
        : "NEAR TRAIN ROUTE";

      items.forEach((item, index) => {
        let snapped = item.point;
        if (isOnRoute && routePath.length > 1) {
          if (items.length > 1) {
            // Find base point nearest on path
            const baseNearest = item.point ? nearestOnPath(item.point, routePath) : null;
            let baseIdx = (baseNearest && Array.isArray(baseNearest))
              ? routePath.findIndex((p) => p && p[0] === baseNearest[0] && p[1] === baseNearest[1])
              : -1;
            if (baseIdx === -1) baseIdx = Math.floor(routePath.length / 2);

            // Spread tasks along route path points around baseIdx so each task has its own milestone!
            const totalSteps = routePath.length;
            const segmentSpan = Math.min(Math.max(Math.floor(totalSteps / 3), 10), 18);
            const startIdx = Math.max(0, baseIdx - Math.floor(segmentSpan / 2));
            const endIdx = Math.min(totalSteps - 1, baseIdx + Math.floor(segmentSpan / 2));
            const spreadStep = (endIdx - startIdx) / (items.length + 1);
            const targetIdx = Math.round(startIdx + spreadStep * (index + 1));
            snapped = routePath[Math.min(routePath.length - 1, Math.max(0, targetIdx))];
          } else {
            snapped = item.point ? nearestOnPath(item.point, routePath) : (routePath[Math.floor(routePath.length / 2)] || null);
          }
        } else if (item.point && routePath.length > 1) {
          const nearest = nearestOnPath(item.point, routePath);
          if (!nearest || !Array.isArray(nearest)) return;
          const dist = Math.hypot(nearest[0] - item.point[0], nearest[1] - item.point[1]);
          if (dist > 0.12) return;
        }

        if (!snapped || !Array.isArray(snapped) || !Number.isFinite(snapped[0]) || !Number.isFinite(snapped[1])) return;
        // Minor lateral offset across track (e.g. Traction on catenary side, Signal on wayside)
        const lateralAngle = (index % 2 === 0 ? 80 : -80) * (Math.PI / 180);
        const point = [snapped[0] + Math.cos(lateralAngle) * 0.0025, snapped[1] + Math.sin(lateralAngle) * 0.0025];
        result.push({ ...item, point, relation });
      });
    });

    return result;
  }, [maintenanceLocations, movementBlockIds, routeSectionIds, selectedTrain, routePath, emergencyReroute]);

  const overviewMaintenance = useMemo(() => maintenanceLocations.filter((item) => item.point), [maintenanceLocations]);
  const serverTrainConflicts = trainConflictsQuery.data?.data || [];
  const storedConflicts = useMemo(() => {
    if (!selectedTrain) return [];
    const tNum = String(selectedTrain.train_number || "").trim();
    const source = serverTrainConflicts.length > 0 ? serverTrainConflicts : (conflicts || []);
    return source.filter((item) => {
      const byId = normalizeId(item.train_id) === selectedTrainId || normalizeId(item.train?.train_id) === selectedTrainId;
      const byNum = tNum && (
        String(item.train?.train_number) === tNum ||
        (item.description && item.description.includes(tNum))
      );
      return byId || byNum;
    });
  }, [serverTrainConflicts, conflicts, selectedTrain, selectedTrainId]);

  const derivedConflicts = useMemo(() => {
    if (!selectedTrain) return [];
    const own = selectedTrain.train_block_movements || [];
    const others = networkTrains.flatMap((train) => (train.train_block_movements || []).filter((movement) => normalizeId(train.train_id) !== selectedTrainId).map((movement) => ({ ...movement, train })));

    // Group train-train overlaps by block so we generate at most 1 distinct conflict per block
    const blockOverlapMap = new Map();
    for (const movement of own) {
      const bId = normalizeId(movement.block_id);
      if (!bId || blockOverlapMap.has(bId)) continue;

      const overlappingOther = others.find((other) =>
        normalizeId(other.block_id) === bId &&
        overlaps(movement.scheduled_entry, movement.scheduled_exit, other.scheduled_entry, other.scheduled_exit)
      );

      if (overlappingOther) {
        blockOverlapMap.set(bId, {
          conflict_id: `movement-${movement.movement_id}-${overlappingOther.movement_id}`,
          conflict_type: "TRAIN_TRAIN_MOVEMENT",
          severity: 3,
          description: `${selectedTrain.train_number} overlaps ${overlappingOther.train.train_number} on ${movement.block?.block_code || "the same block"}.`,
          train: overlappingOther.train,
          block: movement.block,
        });
      }
    }

    const trainConflictsList = Array.from(blockOverlapMap.values());
    const maintenanceConflicts = relevantMaintenance.flatMap(({ task }) => own.filter((movement) => normalizeId(movement.block_id) === normalizeId(task.block_id) && task.preferred_start && overlaps(movement.scheduled_entry, movement.scheduled_exit, task.preferred_start, new Date(new Date(task.preferred_start).getTime() + Number(task.duration_minutes || 0) * 60000))).map((movement) => ({ conflict_id: `maintenance-${task.maintenance_task_id}-${movement.movement_id}`, conflict_type: "TRAIN_MAINTENANCE", severity: Number(task.criticality) >= 4 ? 4 : 3, description: `${selectedTrain.train_number} overlaps ${task.maintenance_type} on ${movement.block?.block_code || "the same block"}.`, train: selectedTrain, block: movement.block, maintenance_task: task })));
    return [...trainConflictsList, ...maintenanceConflicts];
  }, [networkTrains, relevantMaintenance, selectedTrain, selectedTrainId]);

  const trainConflicts = storedConflicts.length > 0 ? storedConflicts : derivedConflicts;
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

  // Auto-select train when navigated from URL parameters (e.g. from Train Drawer, Block Drawer, Conflicts)
  useEffect(() => {
    const urlTrainId = queryParams.get("trainId");
    const urlTrainNumber = queryParams.get("trainNumber");
    const urlBlock = queryParams.get("block") || queryParams.get("blockCode");
    const hasConflictReq = queryParams.get("conflict") === "true" || queryParams.get("conflicts") === "true" || Boolean(queryParams.get("conflictId"));

    let targetTrainId = null;

    // 1. In Indian Railways, trainNumber (e.g. 12615) is unique and authoritative across all systems
    if (urlTrainNumber && trains.length > 0) {
      const match = trains.find((t) => String(t.train_number).trim() === String(urlTrainNumber).trim());
      if (match) {
        targetTrainId = match.train_id;
      }
    }

    // 2. If no trainNumber match found, verify if urlTrainId matches a known train
    if (!targetTrainId && urlTrainId && trains.length > 0) {
      const matchById = trains.find((t) => String(t.train_id) === String(urlTrainId));
      if (matchById) {
        if (!urlTrainNumber || String(matchById.train_number).trim() === String(urlTrainNumber).trim()) {
          targetTrainId = matchById.train_id;
        }
      } else {
        targetTrainId = urlTrainId;
      }
    } else if (!targetTrainId && urlTrainId) {
      targetTrainId = urlTrainId;
    }

    // 3. If only block is provided, match the train that traverses that block
    if (!targetTrainId && urlBlock && networkTrains.length > 0) {
      const matchTrain = networkTrains.find((t) =>
        (t.train_block_movements || []).some((m) =>
          normalizeId(m.block?.block_code) === normalizeId(urlBlock) ||
          normalizeId(m.block_id) === normalizeId(urlBlock)
        )
      );
      if (matchTrain) targetTrainId = matchTrain.train_id;
    }

    if (targetTrainId && targetTrainId !== selectedTrainId) {
      selectTrain(targetTrainId);
    }

    if (hasConflictReq) {
      setLayers((prev) => ({ ...prev, conflicts: true }));
    }
  }, [queryParams, trains, networkTrains, selectedTrainId]);

  const autoFocusedConflictKeyRef = useRef("");

  const handleCloseConflict = useCallback(() => {
    setConflict(null);
    // Remove conflict query parameters from the hash URL so it doesn't immediately re-trigger or stick around
    const params = new URLSearchParams(queryParams.toString());
    let changed = false;
    ["conflict", "conflicts", "conflictId"].forEach((key) => {
      if (params.has(key)) {
        params.delete(key);
        changed = true;
      }
    });
    if (changed) {
      const remaining = params.toString();
      navigate(`/map${remaining ? `?${remaining}` : ""}`);
    }
  }, [queryParams]);

  // When conflict is requested via URL, auto-focus conflict once ready
  useEffect(() => {
    const hasConflictReq = queryParams.get("conflict") === "true" || queryParams.get("conflicts") === "true" || Boolean(queryParams.get("conflictId"));
    if (!hasConflictReq) {
      autoFocusedConflictKeyRef.current = "";
      return;
    }

    const conflictId = queryParams.get("conflictId");
    const urlBlock = queryParams.get("block");
    const currentKey = `${queryParams.get("trainId") || ""}_${queryParams.get("trainNumber") || ""}_${conflictId || ""}_${urlBlock || ""}`;

    if (autoFocusedConflictKeyRef.current === currentKey) {
      return;
    }

    if (trainConflicts.length > 0) {
      let target = null;
      if (conflictId) {
        target = trainConflicts.find((c) => String(c.conflict_id) === String(conflictId));
      }
      if (!target && urlBlock) {
        target = trainConflicts.find((c) =>
          normalizeId(c.block?.block_code) === normalizeId(urlBlock) ||
          normalizeId(c.block_id) === normalizeId(urlBlock)
        );
      }
      if (!target) {
        target = trainConflicts[0];
      }
      if (target) {
        autoFocusedConflictKeyRef.current = currentKey;
        focusConflict(target);
      }
    }
  }, [queryParams, trainConflicts]);

  const rerouteSlwPath = useMemo(() => {
    if (!emergencyReroute || routePoints.length < 2) return [];
    const offset = routePoints.map(([lat, lng]) => [lat + 0.015, lng + 0.015]);
    return corridorPath(offset);
  }, [emergencyReroute, routePoints]);

  const blockedLocation = useMemo(() => {
    if (!emergencyReroute) return null;
    const taskOnBlock = maintenanceLocations.find((m) =>
      normalizeId(m.task?.block?.block_code) === normalizeId(emergencyReroute.block) ||
      normalizeId(m.task?.block_id) === normalizeId(emergencyReroute.block) ||
      m.blockId === normalizeId(emergencyReroute.block)
    );
    let rawPoint = taskOnBlock?.point;
    if (!rawPoint && routePoints.length >= 2) {
      rawPoint = routePoints[Math.floor(routePoints.length / 2)];
    }
    if (rawPoint && routePath.length > 1) {
      return nearestOnPath(rawPoint, routePath);
    }
    return rawPoint || null;
  }, [emergencyReroute, maintenanceLocations, routePoints, routePath]);

  const rerouteTrackData = useMemo(() => {
    if (!emergencyReroute || routePoints.length < 2 || emergencyReroute.strategy !== "CHORD_BYPASS") return null;

    // Check if bypass path or full route was cached in sessionStorage by What-If simulation
    let cachedReroutePath = null;
    try {
      const key1 = `reroute_path_${emergencyReroute.trainId}`;
      const key2 = `reroute_path_${emergencyReroute.trainNumber}`;
      const raw = sessionStorage.getItem(key1) || sessionStorage.getItem(key2);
      if (raw) cachedReroutePath = JSON.parse(raw);
    } catch (e) {}

    const scheduledCodes = routeStations.map((r) => r.station?.station_code).filter(Boolean);
    const bypassOverride = emergencyReroute.bypassPath || cachedReroutePath?.bypass_path || null;

    // Resolve optimal railway graph bypass
    const resolved = resolveBypassRoute({
      scheduledStops: scheduledCodes,
      blockCode: emergencyReroute.block || "B001",
      bypassPathOverride: bypassOverride,
    });

    const stationCoordMap = new Map();
    routeStations.forEach((r) => {
      const c = coordinate(r.station);
      if (c && r.station?.station_code) stationCoordMap.set(r.station.station_code, c);
    });

    if (resolved && resolved.fullRoute && resolved.fullRoute.length >= 2) {
      const trackPoints = resolved.fullRoute.map((code) => {
        if (stationCoordMap.has(code)) return stationCoordMap.get(code);
        const st = STATIONS[code];
        return st ? [st.lat, st.lng] : null;
      }).filter(Boolean);

      if (trackPoints.length >= 2) {
        // Collect bypass waypoints for dedicated marker rendering
        const bypassWaypoints = (resolved.bypassPath || []).slice(1, -1).map((code) => {
          const st = STATIONS[code] || {};
          const pt = stationCoordMap.get(code) || (st.lat ? [st.lat, st.lng] : null);
          return pt ? { code, name: st.name || code, point: pt } : null;
        }).filter(Boolean);

        const cleanTrackPath = (resolved.waypoints && resolved.waypoints.length >= 2) ? resolved.waypoints : trackPoints;
        return {
          path: cleanTrackPath,
          bypassPath: resolved.bypassPath,
          fullRoute: resolved.fullRoute,
          waypoints: bypassWaypoints,
          divergeStation: resolved.divergeStation,
          convergeStation: resolved.convergeStation,
        };
      }
    }

    // High-fidelity fallback:
    // If no explicit graph solution, detour around the blocked area along a track corridor
    const validStations = routeStations.filter(r => {
      const lat = r.station?.latitude;
      const lng = r.station?.longitude;
      return lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
    });

    let firstBypassedIdx = -1;
    let lastBypassedIdx = -1;
    for (let i = 0; i < validStations.length; i++) {
      if (emergencyReroute.bypassed.has(validStations[i].station?.station_code)) {
        if (firstBypassedIdx === -1) firstBypassedIdx = i;
        lastBypassedIdx = i;
      }
    }

    if (firstBypassedIdx !== -1) {
      const divergeIdx = Math.max(0, firstBypassedIdx - 1);
      const rejoinIdx = Math.min(validStations.length - 1, lastBypassedIdx + 1);
      const points = [];
      for (let i = 0; i <= divergeIdx; i++) points.push(routePoints[i]);
      const p1 = routePoints[divergeIdx];
      const p2 = routePoints[rejoinIdx];
      const midLat = (p1[0] + p2[0]) / 2 + 0.35;
      const midLng = (p1[1] + p2[1]) / 2 + 0.35;
      points.push([midLat, midLng]);
      for (let i = rejoinIdx; i < routePoints.length; i++) points.push(routePoints[i]);
      return { path: corridorPath(points), bypassPath: [], waypoints: [] };
    }

    const offset = routePoints.map(([lat, lng]) => [lat + 0.02, lng + 0.02]);
    return { path: corridorPath(offset), bypassPath: [], waypoints: [] };
  }, [emergencyReroute, routePoints, routeStations, blockedLocation]);

  const rerouteChordPath = useMemo(() => {
    return rerouteTrackData?.path || [];
  }, [rerouteTrackData]);

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
    if (!stations.length) {
      if (routePoints.length >= 2) {
        setFocusBounds({ bounds: routePoints, token: Date.now() });
      }
      return;
    }
    const bounds = stations.length > 1 ? stations : [[stations[0][0] - 0.05, stations[0][1] - 0.05], [stations[0][0] + 0.05, stations[0][1] + 0.05]];
    setFocusBounds({ bounds, token: Date.now() });
  }

  const conflictMarkers = useMemo(() => {
    if (!layers.conflicts) return [];
    const seenBlocks = new Set();
    const markers = [];

    for (const c of trainConflicts) {
      const bKey = normalizeId(c.block?.block_id || c.block_id || c.block?.block_code || "");
      if (bKey && seenBlocks.has(bKey)) continue;

      let point = null;
      let targetSection = c.block?.track?.section || c.maintenance_task?.section || null;
      let targetBlock = c.block || null;

      if (c.maintenance_task) {
        const match = maintenanceLocations.find((m) => normalizeId(m.task?.maintenance_task_id) === normalizeId(c.maintenance_task?.maintenance_task_id));
        if (match?.point) point = match.point;
        if (!targetSection && match?.task?.section) targetSection = match.task.section;
        if (!targetBlock && match?.task?.block) targetBlock = match.task.block;
      }
      if (!point && c.block) {
        const bId = normalizeId(c.block.block_id || c.block_id);
        const bCode = normalizeId(c.block.block_code);
        const match = maintenanceLocations.find((m) => m.blockId === bId || normalizeId(m.task?.block?.block_code) === bCode);
        if (match?.point) point = match.point;
        if (!targetSection && match?.task?.section) targetSection = match.task.section;
        if (!targetBlock && match?.task?.block) targetBlock = match.task.block;
      }
      if (!point && routePoints.length > 0) {
        const midIdx = Math.floor(routePoints.length / 2);
        point = routePoints[midIdx];
      }

      if (point && Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
        if (bKey) seenBlocks.add(bKey);
        const sectionId = normalizeId(targetSection?.section_id || targetBlock?.track?.section_id);
        const sectionStations = sectionModel.sections.get(sectionId) || [];
        const blockedTrack = blockTrackSegment(sectionStations, targetSection, targetBlock, point, routePath.length > 1 ? routePath : routePoints);
        markers.push({ conflict: c, point, blockedTrack });
      }
    }

    return markers;
  }, [layers.conflicts, trainConflicts, maintenanceLocations, routePoints, routePath, sectionModel]);

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
          <div className="railway-map-search railway-map-search--white">
            <Search size={16} className="railway-map-search__icon" />
            <input id="train-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number or name" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear train search"><X size={14} /></button>}
          </div>
          <div className="railway-map-train-picker">
            <select
              className="railway-map-train-select-native"
              value={trainId}
              onChange={(event) => selectTrain(event.target.value)}
              aria-label="Select train"
            >
              <option value="">Select a train</option>
              {filteredTrains.map((train) => (
                <option key={train.train_id} value={train.train_id}>
                  {train.train_number} — {train.train_name}
                </option>
              ))}
            </select>
            <div className="railway-map-train-picker__display" aria-hidden="true">
              <span className="railway-map-train-picker__value">
                {trainId
                  ? (() => {
                      const t = filteredTrains.find((tr) => String(tr.train_id) === String(trainId)) ||
                                trains.find((tr) => String(tr.train_id) === String(trainId));
                      return t ? <><b>{t.train_number}</b> — {t.train_name}</> : "Select a train";
                    })()
                  : "Select a train"
                }
              </span>
              <ChevronDown size={16} className="railway-map-train-picker__arrow" />
            </div>
          </div>
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
          <>
            <div className="railway-map-empty">
              <div className="railway-map-empty__icon"><TrainFront size={22} /></div>
              <strong>India railway network</strong>
              <p>Select a train to highlight its route and operational impact, or inspect active network conflicts below.</p>
            </div>
            {conflicts.length > 0 && (
              <section className="railway-map-records" id="railway-map-overview-conflicts" style={{ marginTop: 12 }}>
                <div className="railway-map-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={15} color="#ef4444" />
                    Network Conflicts ({conflicts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/conflicts")}
                    style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 12, padding: 0, fontWeight: 600 }}
                  >
                    View all ↗
                  </button>
                </div>
                {conflicts.slice(0, 5).map((item, index) => (
                  <button
                    type="button"
                    className="railway-map-record railway-map-record--button"
                    key={item.conflict_id || index}
                    onClick={() => focusConflict(item)}
                    title={item.description || "Click to focus conflict on map"}
                  >
                    <span>
                      <b>{humanize(item.conflict_type)}</b>
                      <small>{item.block?.block_code || item.train?.train_number || "Block unavailable"}</small>
                    </span>
                    <Badge tone={SEVERITY_TONE[item.severity] || "red"}>
                      {SEVERITY_LABEL[item.severity] || "Conflict"}
                    </Badge>
                  </button>
                ))}
                {conflicts.length > 5 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    style={{ width: "100%", marginTop: 8 }}
                    onClick={() => navigate("/conflicts")}
                  >
                    See all {conflicts.length} conflicts in detail →
                  </Button>
                )}
              </section>
            )}
          </>
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
                <Metric
                  label="Blocks"
                  value={affectedBlocks.length}
                  tone="blue"
                  onClick={() => navigate("/blocks")}
                  title="Click to view Blocks page"
                />
                <Metric
                  label="Maintenance"
                  value={relevantMaintenance.length}
                  tone="amber"
                  onClick={() => navigate("/maintenance")}
                  title="Click to view Maintenance Tasks page"
                />
                <Metric
                  label="Conflicts"
                  value={trainConflicts.length}
                  tone={trainConflicts.length ? "red" : "green"}
                  onClick={() => {
                    if (selectedTrain) {
                      navigate(`/conflicts?trainNumber=${selectedTrain.train_number}&trainName=${encodeURIComponent(selectedTrain.train_name || "")}&trainId=${selectedTrain.train_id}`);
                    } else {
                      navigate("/conflicts");
                    }
                  }}
                  title={selectedTrain ? `Click to view ${trainConflicts.length} conflict(s) for Train ${selectedTrain.train_number} in Conflict Analysis` : "Click to view Conflicts page"}
                />
                <Metric label="Delay min" value={routeMaxDelay !== null ? (routeMaxDelay > 15 ? `+${routeMaxDelay}` : routeMaxDelay > 5 ? `+${routeMaxDelay}` : routeMaxDelay > 0 ? `+${routeMaxDelay}` : "0") : "-"} tone={routeMaxDelay === null ? "violet" : routeMaxDelay > 15 ? "red" : routeMaxDelay > 5 ? "red" : routeMaxDelay > 0 ? "amber" : "green"} />
              </div>
            </section>
            <RouteTimeline stations={routeStations} activeKey={activeStationKey} onSelect={(route) => selectStation(route, true)} />
          </>
        )}
        {selectedTrain && trainConflicts.length > 0 && (
          <section className="railway-map-records" id="railway-map-conflicts-section">
            <div className="railway-map-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={15} /> Conflicts ({trainConflicts.length})</span>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                style={{ fontSize: 11, padding: "2px 8px" }}
                onClick={() => navigate(`/conflicts?trainNumber=${selectedTrain.train_number}&trainName=${encodeURIComponent(selectedTrain.train_name || "")}&trainId=${selectedTrain.train_id}`)}
                title="View and filter all conflicts for this train in Conflicts page"
              >
                Analyze all →
              </button>
            </div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <span className="railway-map-toolbar__kicker">RAILSETU / LIVE NETWORK</span>
              <strong>{selectedTrain ? `${selectedTrain.train_number} - ${selectedTrain.train_name}` : "India network overview"}</strong>
            </div>
            {emergencyReroute && isEmergencyHudDismissed && (
              <button
                type="button"
                className="railway-emergency-badge-btn"
                onClick={() => {
                  setIsEmergencyHudDismissed(false);
                  setIsEmergencyHudMinimized(false);
                }}
                title="Restore emergency diversion notification"
              >
                <ShieldAlert size={14} color="#ef4444" />
                <span>Block {emergencyReroute.block} Diversion Active</span>
                <span className="railway-emergency-badge-btn__action">Show Alert ▴</span>
              </button>
            )}
          </div>
          <div className="railway-map-toolbar__actions">
            <Button variant="secondary" size="sm" onClick={fitIndia}>Fit India</Button>
            <Button variant="primary" size="sm" disabled={routePoints.length < 2} onClick={fitRoute}>Fit train route</Button>
          </div>
        </div>
        <div className="railway-map-map-shell">
          <MapContainer
            center={INDIA_CENTER}
            bounds={INDIA_BOUNDS}
            boundsOptions={{ padding: [20, 20] }}
            maxBounds={[[4, 64], [39, 102]]}
            maxBoundsViscosity={0.55}
            minZoom={3.2}
            maxZoom={13}
            zoom={5}
            zoomSnap={0.1}
            zoomDelta={0.5}
            zoomAnimation
            style={{ height: "100%", width: "100%" }}
          >
            <BoundaryLayers districts={boundaries.districts} states={boundaries.states} />
            <ResponsiveMapController isTrainSelected={Boolean(selectedTrain)} points={routePoints} />
            <MapViewport points={routePoints} request={viewportRequest} focus={focusBounds ? { bounds: focusBounds.bounds, onDone: () => setFocusBounds(null) } : null} />
            <StationLabelManager count={routeStations.length} />
            {/* Permanent Physical Railway Track Network */}
            {physicalTracks.map((track) => (
              <Polyline
                key={track.key}
                positions={track.positions}
                className="railway-route-network"
                pathOptions={{
                  color: track.type === "CHORD" ? "#1f4870" : "#24507a",
                  weight: track.type === "CHORD" ? 2 : 2.5,
                  dashArray: track.type === "CHORD" ? "6, 4" : undefined,
                  opacity: selectedTrain ? 0.35 : 0.6,
                  smoothFactor: 1,
                }}
              >
                <Tooltip className="railway-network-tooltip">
                  Track: {track.fromName} ↔ {track.toName} ({track.dist} km • {track.type === "CHORD" ? "Chord Bypass Line" : "Main Corridor"})
                </Tooltip>
              </Polyline>
            ))}
            {networkRoutes.map(({ train, path }) => {
              const isSelected = selectedTrainId === normalizeId(train.train_id);
              if (isSelected) return null;
              const trainSelected = Boolean(selectedTrain);
              const baseColor = "#2a5b82";
              const baseWeight = 1.5;
              const baseOpacity = trainSelected ? 0.38 : 0.6;
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
                    click: () => selectTrain(train.train_id),
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
                      pathOptions={{ color: "#94a3b8", weight: 3.5, dashArray: "6, 8", opacity: 0.8, smoothFactor: 0, interactive: false }}
                    />

                    {/* 2. Rerouted Diversion Path */}
                    {emergencyReroute.strategy === "CHORD_BYPASS" && rerouteChordPath.length > 1 ? (
                      <>
                        <Polyline positions={rerouteChordPath} className="railway-route-glow" pathOptions={{ color: "#f59e0b", weight: routeGlowWeight, opacity: 0.25, smoothFactor: 0, interactive: false }} />
                        <Polyline positions={rerouteChordPath} className="railway-route-core" pathOptions={{ color: "#f59e0b", weight: 5, dashArray: "10, 6", opacity: 1, smoothFactor: 0, interactive: false }} />
                        <RouteParticles path={rerouteChordPath} />
                      </>
                    ) : (
                      <>
                        <Polyline positions={rerouteSlwPath.length > 1 ? rerouteSlwPath : routePath} className="railway-route-glow" pathOptions={{ color: "#22c55e", weight: routeGlowWeight, opacity: 0.25, smoothFactor: 0, interactive: false }} />
                        <Polyline positions={rerouteSlwPath.length > 1 ? rerouteSlwPath : routePath} className="railway-route-core" pathOptions={{ color: "#22c55e", weight: 5, opacity: 1, smoothFactor: 0, interactive: false }} />
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
                    <Polyline positions={routePath} className="railway-route-glow" pathOptions={{ color: "#22d3ee", weight: routeGlowWeight, opacity: 0.16, smoothFactor: 0, interactive: false }} />
                    <Polyline positions={routePath} className="railway-route-core" pathOptions={{ color: "#22d3ee", weight: 5, opacity: 1, smoothFactor: 0, interactive: false }} />
                    <RouteParticles path={routePath} />
                  </>
                )}
              </>
            )}
            {layers.stations && (routeStations.length > 0 ? routeStations : [
              selectedTrain?.origin_station ? { station: selectedTrain.origin_station, sequence_number: 1 } : null,
              selectedTrain?.destination_station ? { station: selectedTrain.destination_station, sequence_number: 2 } : null,
            ].filter(Boolean)).map((route, index, arr) => {
              const point = coordinate(route.station);
              const code = route.station?.station_code;
              let role = index === 0 ? "source" : index === arr.length - 1 ? "destination" : "intermediate";
              const isBypassed = emergencyReroute?.bypassed?.has(code);
              const isServed = emergencyReroute ? (emergencyReroute.served?.size > 0 ? emergencyReroute.served.has(code) : !isBypassed) : false;
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
            {/* 4. Render Bypass Waypoint Markers for CHORD_BYPASS */}
            {emergencyReroute?.strategy === "CHORD_BYPASS" && (rerouteTrackData?.waypoints || []).map((wp, wIdx) => {
              if (!wp.point) return null;
              return (
                <Marker
                  key={`bypass-wp-${wp.code}-${wIdx}`}
                  position={wp.point}
                  icon={L.divIcon({
                    className: "railway-station-icon-wrap",
                    html: `<span class="railway-station-icon railway-station-icon--intermediate" style="background:#f59e0b;border:2.5px solid #ffffff;box-shadow:0 0 12px rgba(245,158,11,0.9);width:16px;height:16px;"></span>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                >
                  <Tooltip permanent direction="top" className="railway-station-tooltip" offset={[0, -10]}>
                    <span style={{ color: "#fcd34d", fontWeight: 700 }}>🔄 {wp.name || wp.code}</span> (Bypass Waypoint)
                  </Tooltip>
                  <Popup>
                    <strong style={{ color: "#f59e0b" }}>🔄 Bypass Waypoint: {wp.name} ({wp.code})</strong><br />
                    <span>Active Railway Corridor Diversion Route</span><br />
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                      Train proceeds via this chord junction to avoid Block {emergencyReroute.block}.
                    </span>
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
            {/* Render blocked track portion in red for each conflict */}
            {conflictMarkers.map(({ conflict: item, blockedTrack }) => {
              if (!blockedTrack || blockedTrack.length < 2) return null;
              return (
                <Polyline
                  key={`conflict-track-${item.conflict_id}`}
                  positions={blockedTrack}
                  pathOptions={{
                    color: "#ef4444",
                    weight: 6,
                    opacity: 0.95,
                    dashArray: "8, 5",
                    lineCap: "round",
                    smoothFactor: 0,
                  }}
                  eventHandlers={{ click: () => focusConflict(item) }}
                >
                  <Tooltip className="railway-conflict-tooltip">
                    <strong>🚫 BLOCKED TRACK: Block {item.block?.block_code || item.train?.train_number || "—"}</strong>
                    <br />{humanize(item.conflict_type)}
                  </Tooltip>
                </Polyline>
              );
            })}

            {/* Render stationary conflict point dot matching legend */}
            {conflictMarkers.map(({ conflict: item, point }) => {
              const sev = Number(item.severity) || 3;
              return (
                <Marker
                  key={`conflict-marker-${item.conflict_id}`}
                  position={point}
                  icon={conflictIcon(sev, 1)}
                  eventHandlers={{ click: () => focusConflict(item) }}
                >
                  <Tooltip className="railway-conflict-tooltip">
                    <strong>⚠ Conflict: {humanize(item.conflict_type)}</strong>
                    <br />Block: {item.block?.block_code || item.train?.train_number || "—"} · Sev {sev}
                  </Tooltip>
                  <Popup>
                    <strong style={{ color: "#ef4444" }}>{humanize(item.conflict_type)}</strong><br />
                    <span>Block: <b>{item.block?.block_code || "—"}</b></span><br />
                    <span>Severity: <b>Level {sev}</b></span><br />
                    <p style={{ margin: "4px 0 6px", fontSize: 11 }}>{item.description || "Operational overlap detected."}</p>
                    <button
                      type="button"
                      style={{ marginTop: 4, fontSize: 11, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onClick={() => {
                        const tNum = selectedTrain?.train_number || item.train?.train_number || "";
                        const tName = selectedTrain?.train_name || item.train?.train_name || "";
                        const bCode = item.block?.block_code || "";
                        navigate(`/conflicts?conflictId=${item.conflict_id || ""}&trainNumber=${tNum}&trainName=${encodeURIComponent(tName)}&block=${bCode}`);
                      }}
                    >
                      View in Conflicts analysis →
                    </button>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          {emergencyReroute && !isEmergencyHudDismissed && (
            isEmergencyHudMinimized ? (
              <div className="railway-map-emergency-hud railway-map-emergency-hud--minimized">
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  onClick={() => setIsEmergencyHudMinimized(false)}
                  title="Click to expand full emergency details"
                >
                  <ShieldAlert size={16} color="#ef4444" />
                  <span style={{ fontWeight: 700, color: "#fca5a5", fontSize: 12 }}>
                    🚨 Block {emergencyReroute.block} — {emergencyReroute.strategyName}
                  </span>
                  <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 600, marginLeft: 4 }}>
                    ✓ {emergencyReroute.served.size > 0 ? emergencyReroute.served.size : Math.max(0, (routeStations.length || 10) - emergencyReroute.bypassed.size)} Preserved
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setIsEmergencyHudMinimized(false)}
                    className="railway-map-emergency-hud__icon-btn"
                    title="Expand notification"
                    aria-label="Expand notification"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEmergencyHudDismissed(true)}
                    className="railway-map-emergency-hud__icon-btn"
                    title="Cut / Hide notification banner"
                    aria-label="Cut notification banner"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
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
                    {rerouteTrackData?.bypassPath && rerouteTrackData.bypassPath.length > 0 && (
                      <div style={{ fontSize: 11, color: "#fcd34d", marginTop: 3 }}>
                        Chord Diversion Track: <strong>{rerouteTrackData.bypassPath.join(" → ")}</strong>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: "#4ade80", fontWeight: 600, fontSize: 12 }}>
                    ✓ {emergencyReroute.served.size > 0 ? emergencyReroute.served.size : Math.max(0, (routeStations.length || 10) - emergencyReroute.bypassed.size)} Stoppages Preserved
                  </span>
                  {emergencyReroute.bypassed.size > 0 && (
                    <span style={{ color: "#f87171", fontWeight: 600, fontSize: 12 }}>
                      ⚠ {emergencyReroute.bypassed.size} Bypassed (Bus Bridge Alert)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyReroute(null);
                      window.location.hash = "/map";
                    }}
                    className="railway-map-emergency-hud__close"
                    title="Exit emergency diversion and return to standard train schedule"
                  >
                    ✕ Exit Diversion
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEmergencyHudMinimized(true)}
                    className="railway-map-emergency-hud__icon-btn"
                    title="Minimize notification"
                    aria-label="Minimize notification"
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEmergencyHudDismissed(true)}
                    className="railway-map-emergency-hud__icon-btn"
                    title="Cut / Hide notification banner"
                    aria-label="Cut notification banner"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          )}
          <NetworkStatusHud
            trains={hudTrains}
            activeBlocks={hudBlocks}
            maintenance={hudMaintenance}
            conflicts={hudConflicts}
            layers={layers}
            onToggleLayer={toggleLayer}
            isMinimized={isNetworkHudMinimized}
            onToggleMinimize={setIsNetworkHudMinimized}
            selectedTrain={selectedTrain}
          />
          {isLegendMinimized ? (
            <div
              className="railway-map-legend railway-map-legend--minimized"
              onClick={() => setIsLegendMinimized(false)}
              title="Click to expand Legend"
              role="button"
              tabIndex={0}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <Layers3 size={13} color="#67e8f9" />
                <strong style={{ margin: 0, color: "#f0f8ff", fontSize: 11, letterSpacing: "0.08em" }}>Legend</strong>
                <ChevronUp size={14} style={{ color: "#67e8f9", marginLeft: 4 }} />
              </div>
            </div>
          ) : (
            <div className="railway-map-legend">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Layers3 size={13} color="#67e8f9" />
                  <strong style={{ margin: 0, color: "#f0f8ff", fontSize: 11, letterSpacing: "0.1em" }}>Legend</strong>
                </div>
                <button
                  type="button"
                  className="railway-map-legend__btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLegendMinimized(true);
                  }}
                  title="Minimize Legend"
                  aria-label="Minimize Legend"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <span><i className="railway-map-legend-line" />Selected route</span>
              <span><i className="railway-map-legend-line railway-map-legend-line--dim" />Railway corridor</span>
              <span><i className="railway-map-legend-dot railway-map-legend-dot--source" />Source</span>
              <span><i className="railway-map-legend-dot railway-map-legend-dot--destination" />Destination</span>
              <span><i className="railway-map-legend-dot railway-map-legend-dot--station" />Station</span>
              <span><i className="railway-map-legend-dot railway-map-legend-dot--engineering" />Engineering</span>
              <span><i className="railway-map-legend-dot railway-map-legend-dot--traction" />Traction</span>
              <span><i className="railway-map-legend-dot railway-map-legend-dot--signalling" />Signalling</span>
              <span><i className="railway-map-legend-dot railway-map-legend-dot--critical" />Critical / conflict</span>
              <span><i className="railway-map-legend-line" style={{ background: "#ef4444", border: "1px dashed rgba(255,255,255,0.4)", height: "3px" }} />Blocked track segment</span>
              {emergencyReroute && (
                <>
                  <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                  <span><i className="railway-map-legend-line" style={{ background: "#94a3b8" }} />Original scheduled path</span>
                  <span><i className="railway-map-legend-line" style={{ background: emergencyReroute.strategy === "CHORD_BYPASS" ? "#f59e0b" : "#22c55e" }} />Rerouted trajectory</span>
                  <span><i className="railway-map-legend-dot" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />Preserved stop</span>
                  <span><i className="railway-map-legend-dot" style={{ background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />Bypassed / skipped stop</span>
                  {emergencyReroute.strategy === "CHORD_BYPASS" && (
                    <span><i className="railway-map-legend-dot" style={{ background: "#f59e0b", boxShadow: "0 0 8px #f59e0b" }} />Bypass track waypoint</span>
                  )}
                </>
              )}
            </div>
          )}
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
      <Drawer
        open={Boolean(conflict)}
        onClose={handleCloseConflict}
        title="Conflict details"
        subtitle={conflict ? (conflict.plan_id ? `Plan #${conflict.plan_id}` : "Operational Conflict") : ""}
        footer={
          conflict && (
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tNum = selectedTrain?.train_number || conflict.train?.train_number || "";
                  const tName = selectedTrain?.train_name || conflict.train?.train_name || "";
                  const bCode = conflict.block?.block_code || "";
                  navigate(`/conflicts?conflictId=${conflict.conflict_id || ""}&trainNumber=${tNum}&trainName=${encodeURIComponent(tName)}&block=${bCode}`);
                }}
                style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
              >
                View in Conflicts Table ↗
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCloseConflict}>
                Close
              </Button>
            </div>
          )
        }
      >
        {conflict && (
          <div className="railway-map-drawer-content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <Badge tone={SEVERITY_TONE[conflict.severity] || "red"}>
                {SEVERITY_LABEL[conflict.severity] || "Conflict"} · Level {conflict.severity || 3}
              </Badge>
              <Badge tone={conflict.resolved ? "green" : "red"} dot>
                {conflict.resolved ? "Resolved" : "Active Conflict"}
              </Badge>
            </div>

            {conflict.description && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "#fca5a5",
                  lineHeight: 1.5,
                }}
              >
                {conflict.description}
              </div>
            )}

            <DetailSection title="Conflict Overview">
              <DetailList
                items={[
                  { label: "Conflict Type", value: humanize(conflict.conflict_type) || "—" },
                  { label: "Severity", value: `Level ${conflict.severity || 1} (${SEVERITY_LABEL[conflict.severity] || "Standard"})` },
                  { label: "Block Plan ID", value: conflict.plan_id ? `#${conflict.plan_id}` : "Auto-detected" },
                  { label: "Detected At", value: conflict.created_at ? new Date(conflict.created_at).toLocaleString() : "Real-time" },
                ]}
              />
            </DetailSection>

            {(conflict.block || conflict.plan?.block) && (() => {
              const blk = conflict.block || conflict.plan?.block;
              return (
                <DetailSection title="Affected Infrastructure Block">
                  <DetailList
                    items={[
                      { label: "Block Code", value: <strong style={{ color: "#ef4444" }}>{blk.block_code || "—"}</strong> },
                      { label: "Section", value: blk.track?.section?.section_name || blk.track?.section?.section_code || blk.section_code || "—" },
                      { label: "Track Line", value: blk.track?.track_name || blk.track?.track_code || "—" },
                      {
                        label: "Chainage Span",
                        value: blk.start_chainage != null && blk.end_chainage != null
                          ? `${Number(blk.start_chainage).toFixed(1)} km – ${Number(blk.end_chainage).toFixed(1)} km`
                          : "—",
                      },
                      { label: "Block Status", value: <Badge tone={blk.status === "AVAILABLE" ? "amber" : "red"}>{blk.status || "BLOCKED"}</Badge> },
                    ]}
                  />
                </DetailSection>
              );
            })()}

            {(conflict.maintenance_task || conflict.task) && (() => {
              const mt = conflict.maintenance_task || conflict.task;
              return (
                <DetailSection title="Overlapping Maintenance Task">
                  <DetailList
                    items={[
                      { label: "Activity Type", value: mt.maintenance_type || "—" },
                      { label: "Department", value: mt.department || "—" },
                      { label: "Criticality", value: `Level ${mt.criticality || 3}` },
                      { label: "Duration", value: `${mt.duration_minutes || 60} minutes` },
                      { label: "Scheduled Window", value: mt.preferred_start ? new Date(mt.preferred_start).toLocaleString() : "—" },
                    ]}
                  />
                </DetailSection>
              );
            })()}

            {conflict.train && (
              <DetailSection title="Affected Train">
                <DetailList
                  items={[
                    { label: "Train Number", value: conflict.train.train_number || "—" },
                    { label: "Train Name", value: conflict.train.train_name || "—" },
                    { label: "Priority", value: priorityInfo(conflict.train).short },
                    {
                      label: "Route Corridor",
                      value: `${conflict.train.origin_station?.station_code || conflict.train.origin_station?.station_name || "?"} → ${conflict.train.destination_station?.station_code || conflict.train.destination_station?.station_name || "?"}`,
                    },
                  ]}
                />
              </DetailSection>
            )}

            {selectedTrain && conflict.train && selectedTrain.train_id !== conflict.train.train_id && (
              <div className="railway-map-drawer-release" style={{ marginTop: 8 }}>
                <div className="railway-map-section-title"><TrainFront size={15} /> Collision Precedence & Release Order</div>
                <ReleaseOrder selectedTrain={selectedTrain} otherTrain={conflict.train} />
                <div className="railway-tree" style={{ marginTop: 8 }}>
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
