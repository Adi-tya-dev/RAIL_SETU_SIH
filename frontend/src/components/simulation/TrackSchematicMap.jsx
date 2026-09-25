import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, ExternalLink, Compass } from "lucide-react";
import { navigate } from "../../hooks/useRoute";

export default function TrackSchematicMap({ train, activeStrategy, emergencyEvent }) {
  const [hoveredStation, setHoveredStation] = useState(null);

  if (!train || !activeStrategy) return null;

  const isSLW = activeStrategy.id === "SLW";
  const isChord = activeStrategy.id === "CHORD_BYPASS";
  const isHold = activeStrategy.id === "STATION_HOLD";

  const stops = train.scheduled_stops || [];
  const servedStops = new Set(activeStrategy.stops_served || []);
  const bypassedStops = new Set(activeStrategy.stops_bypassed || []);

  const blockCode = emergencyEvent?.block_code || "B002";
  const duration = emergencyEvent?.closure_duration_minutes || 120;

  function handleOpenGisMap() {
    const params = new URLSearchParams({
      trainId: train.train_id,
      trainNumber: train.train_number,
      block: blockCode,
      strategy: activeStrategy.id,
      strategyName: activeStrategy.name,
      bypassed: (activeStrategy.stops_bypassed || []).join(","),
    });
    navigate(`/map?${params.toString()}`);
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: "16px 18px",
        background: "radial-gradient(ellipse at 50% 0%, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))",
        border: "1px solid rgba(56, 189, 248, 0.25)",
        borderRadius: 10,
        boxShadow: "0 6px 24px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Schematic Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Compass size={18} color="#38bdf8" />
          <strong style={{ fontSize: 13, color: "#f8fafc", letterSpacing: 0.5 }}>
            ROUTE SCHEMATIC & TRACK TRAJECTORY
          </strong>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: isSLW ? "rgba(34, 197, 94, 0.15)" : isChord ? "rgba(245, 158, 11, 0.15)" : "rgba(148, 163, 184, 0.15)",
              color: isSLW ? "#4ade80" : isChord ? "#fbbf24" : "#94a3b8",
              fontWeight: 600,
              border: `1px solid ${isSLW ? "rgba(34, 197, 94, 0.3)" : isChord ? "rgba(245, 158, 11, 0.3)" : "rgba(148, 163, 184, 0.3)"}`,
            }}
          >
            {activeStrategy.name}
          </span>
        </div>

        <button
          onClick={handleOpenGisMap}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(56, 189, 248, 0.15)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            color: "#38bdf8",
            padding: "5px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(56, 189, 248, 0.28)";
            e.currentTarget.style.borderColor = "#38bdf8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)";
            e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
          }}
        >
          <ExternalLink size={14} />
          <span>Open in Live Railway GIS Map</span>
        </button>
      </div>

      {/* SVG Interactive Track Diagram */}
      <div style={{ position: "relative", width: "100%", overflowX: "auto", padding: "10px 0" }}>
        <svg
          viewBox="0 0 940 200"
          style={{
            width: "100%",
            minWidth: 720,
            height: "auto",
            display: "block",
            overflow: "visible",
          }}
        >
          <defs>
            {/* Striped hazard pattern for blocked track */}
            <pattern id="hazard-stripe" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="12" stroke="#ef4444" strokeWidth="4" />
              <line x1="6" y1="0" x2="6" y2="12" stroke="#7f1d1d" strokeWidth="4" />
            </pattern>

            {/* Glow filters */}
            <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="red-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* BACKGROUND TRACK LABELS */}
          <text x="15" y="44" fill="#64748b" fontSize="11" fontFamily="monospace" fontWeight="600">MAIN LINE (UP)</text>
          <text x="15" y="134" fill="#64748b" fontSize="11" fontFamily="monospace" fontWeight="600">
            {isSLW ? "PARALLEL TRACK (DOWN / SLW)" : isChord ? "OUTER CHORD BYPASS LINE" : "LOOP LINE SIDING"}
          </text>

          {/* MAIN LINE (Track 1) */}
          <line x1="130" y1="50" x2="890" y2="50" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
          <line x1="130" y1="50" x2="890" y2="50" stroke="#475569" strokeWidth="2" strokeDasharray="3 6" />

          {/* PARALLEL TRACK BASELINE (Track 2) */}
          <line x1="130" y1="140" x2="890" y2="140" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
          <line x1="130" y1="140" x2="890" y2="140" stroke="#475569" strokeWidth="2" strokeDasharray="3 6" />

          {/* Calculate dynamic sector geometry */}
          {(() => {
            const total = Math.max(stops.length, 1);
            const getX = (idx) => stops.length === 1 ? 510 : 155 + (idx / (total - 1)) * 690;
            
            // Check if any intermediate stations actually sit on the lower parallel track
            const hasStopsBelow = isSLW && stops.some((_, idx) => idx > 0 && idx < total - 1);

            // Find bypassed station indices
            const bypassedIndices = stops.map((s, idx) => bypassedStops.has(s) ? idx : -1).filter((idx) => idx !== -1);
            
            let blockStartX = 340;
            let blockEndX = 560;
            if (bypassedIndices.length > 0) {
              const minIdx = Math.min(...bypassedIndices);
              const maxIdx = Math.max(...bypassedIndices);
              blockStartX = Math.max(130, getX(minIdx) - 45);
              blockEndX = Math.min(880, getX(maxIdx) + 45);
            } else if (stops.length >= 3) {
              const mid = Math.floor(stops.length / 2);
              blockStartX = getX(mid) - 50;
              blockEndX = getX(mid) + 50;
            }

            const divX = Math.max(140, blockStartX - 40);
            const convX = Math.min(880, blockEndX + 40);

            return (
              <>
                {/* BLOCKED TRACK ZONE ON MAIN LINE */}
                <rect
                  x={blockStartX}
                  y="42"
                  width={blockEndX - blockStartX}
                  height="16"
                  fill="url(#hazard-stripe)"
                  rx="4"
                  filter="url(#red-glow)"
                />
                <rect
                  x={blockStartX}
                  y="42"
                  width={blockEndX - blockStartX}
                  height="16"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  rx="4"
                />
                {/* Blocked Sector Top Callout Badge */}
                <g transform={`translate(${(blockStartX + blockEndX) / 2}, 16)`}>
                  <rect x="-80" y="-10" width="160" height="18" rx="9" fill="#7f1d1d" stroke="#ef4444" strokeWidth="1" />
                  <text x="0" y="3" fill="#fca5a5" fontSize="9.5" fontWeight="700" textAnchor="middle">
                    🛑 BLOCKED: {blockCode} ({duration}m)
                  </text>
                </g>

                {/* DIVERSION / REROUTE TRAJECTORY */}
                {isSLW && (
                  <g>
                    {/* Approaching main track */}
                    <line x1="130" y1="50" x2={divX} y2="50" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                    
                    {/* Crossover 1: Main -> Parallel Track */}
                    <path
                      d={`M ${divX} 50 C ${divX + 25} 50, ${divX + 25} 140, ${divX + 50} 140`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="4"
                      strokeDasharray="5 3"
                    />
                    <circle cx={divX} cy="50" r="4" fill="#38bdf8" />
                    <text x={divX} y="38" fill="#38bdf8" fontSize="8.5" textAnchor="middle" fontWeight="600">Turnout 1</text>

                    {/* SLW Section along parallel track */}
                    <line x1={divX + 50} y1="140" x2={convX - 50} y2="140" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
                    
                    {/* Label Placement: If stations exist below, position in gap above parallel track (y = 95). If no stations below, write below parallel track (y = 165) */}
                    {hasStopsBelow ? (
                      <g transform={`translate(${(divX + convX) / 2}, 95)`}>
                        <rect
                          x="-185"
                          y="-12"
                          width="370"
                          height="24"
                          rx="12"
                          fill="rgba(6, 20, 32, 0.94)"
                          stroke="#22c55e"
                          strokeWidth="1.2"
                        />
                        <text
                          x="0"
                          y="4.5"
                          fill="#4ade80"
                          fontSize="9.5"
                          fontWeight="700"
                          textAnchor="middle"
                          letterSpacing="0.03em"
                        >
                          ◄── Single Line Working on Parallel Track (100% Stops Preserved) ──►
                        </text>
                      </g>
                    ) : (
                      <text
                        x={(divX + convX) / 2}
                        y="165"
                        fill="#4ade80"
                        fontSize="9.5"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        ◄── Single Line Working on Parallel Track (100% Stops Preserved) ──►
                      </text>
                    )}

                    {/* Crossover 2: Parallel -> Main Track */}
                    <path
                      d={`M ${convX - 50} 140 C ${convX - 25} 140, ${convX - 25} 50, ${convX} 50`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="4"
                      strokeDasharray="5 3"
                    />
                    <circle cx={convX} cy="50" r="4" fill="#38bdf8" />
                    <text x={convX} y="38" fill="#38bdf8" fontSize="8.5" textAnchor="middle" fontWeight="600">Turnout 2</text>

                    {/* Continuing on Main Track */}
                    <line x1={convX} y1="50" x2="890" y2="50" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                  </g>
                )}

                {isChord && (
                  <g>
                    {/* Approaching main track before chord branch */}
                    <line x1="130" y1="50" x2={divX} y2="50" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />

                    {/* Chord line divergence branch */}
                    <path
                      d={`M ${divX} 50 C ${divX + 35} 50, ${divX + 25} 140, ${divX + 50} 140`}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="4"
                      strokeDasharray="6 3"
                    />
                    <circle cx={divX} cy="50" r="5" fill="#f59e0b" />
                    <text x={divX} y="38" fill="#fbbf24" fontSize="8.5" textAnchor="middle" fontWeight="600">Chord Divergence</text>

                    {/* Chord line bypass track */}
                    <line x1={divX + 50} y1="140" x2={convX - 50} y2="140" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                    
                    {/* Label Placement: If stations exist below, position in gap above parallel track (y = 95). If no stations below, write below parallel track (y = 165) */}
                    {hasStopsBelow ? (
                      <g transform={`translate(${(divX + convX) / 2}, 95)`}>
                        <rect
                          x="-170"
                          y="-12"
                          width="340"
                          height="24"
                          rx="12"
                          fill="rgba(24, 18, 5, 0.94)"
                          stroke="#f59e0b"
                          strokeWidth="1.2"
                        />
                        <text
                          x="0"
                          y="4.5"
                          fill="#fbbf24"
                          fontSize="9.5"
                          fontWeight="700"
                          textAnchor="middle"
                          letterSpacing="0.03em"
                        >
                          ──► Outer Chord Bypass (Bypasses Blocked Sector) ──►
                        </text>
                      </g>
                    ) : (
                      <text
                        x={(divX + convX) / 2}
                        y="165"
                        fill="#fbbf24"
                        fontSize="9.5"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        ──► Outer Chord Bypass (Bypasses Blocked Sector) ──►
                      </text>
                    )}

                    {/* Chord convergence back to main line */}
                    <path
                      d={`M ${convX - 50} 140 C ${convX - 25} 140, ${convX - 35} 50, ${convX} 50`}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="4"
                      strokeDasharray="6 3"
                    />
                    <circle cx={convX} cy="50" r="5" fill="#f59e0b" />
                    <text x={convX} y="38" fill="#fbbf24" fontSize="8.5" textAnchor="middle" fontWeight="600">Rejoins Main Line</text>

                    {/* Continuing on Main Line */}
                    <line x1={convX} y1="50" x2="890" y2="50" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />
                  </g>
                )}

                {isHold && (
                  <g>
                    <line x1="130" y1="50" x2={divX} y2="50" stroke="#f87171" strokeWidth="4" strokeLinecap="round" />
                    <rect x={divX} y="38" width="12" height="24" fill="#ef4444" rx="2" />
                    <text x={divX} y="32" fill="#f87171" fontSize="10" textAnchor="middle" fontWeight="700">
                      🛑 HELD AT PRECEDING PLATFORM
                    </text>
                  </g>
                )}

                {/* STATIONS POSITIONED ALONG THE ROUTE */}
                {stops.map((stationCode, idx) => {
                  const xPos = getX(idx);
                  const isServed = servedStops.has(stationCode);
                  const isBypassed = bypassedStops.has(stationCode);
                  
                  // In SLW: all intermediate stations are accessed via parallel track (y = 140)
                  // In Chord: bypassed stations sit on blocked main track (y = 50), served stations sit on normal track (y = 50)
                  const yPos = (isSLW && idx > 0 && idx < total - 1) ? 140 : 50;
                  const isHovered = hoveredStation === stationCode;

                  return (
                    <g
                      key={stationCode}
                      transform={`translate(${xPos}, ${yPos})`}
                      onMouseEnter={() => setHoveredStation(stationCode)}
                      onMouseLeave={() => setHoveredStation(null)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Station Node Outer Halo */}
                      <circle
                        cx="0"
                        cy="0"
                        r={isHovered ? 15 : isBypassed ? 12 : 10.5}
                        fill={isBypassed ? "rgba(239, 68, 68, 0.25)" : "rgba(34, 197, 94, 0.25)"}
                        stroke={isBypassed ? "#ef4444" : "#22c55e"}
                        strokeWidth={isBypassed ? 2.5 : 2}
                        filter={isBypassed ? "url(#red-glow)" : "url(#cyan-glow)"}
                      />

                      {/* Station Inner Core */}
                      <circle
                        cx="0"
                        cy="0"
                        r={isBypassed ? 5.5 : 4.5}
                        fill={isBypassed ? "#dc2626" : "#16a34a"}
                      />

                      {/* Station Code Label */}
                      <text
                        x="0"
                        y={yPos === 50 ? (isBypassed ? 25 : -16) : 25}
                        fill={isBypassed ? "#f87171" : "#4ade80"}
                        fontSize="11"
                        fontWeight="800"
                        textAnchor="middle"
                        fontFamily="system-ui, sans-serif"
                      >
                        {isBypassed ? `⚠ ${stationCode}` : `✓ ${stationCode}`}
                      </text>

                      {/* Status Sub-badge: Clean compact label to eliminate horizontal overlap */}
                      <text
                        x="0"
                        y={yPos === 50 ? (isBypassed ? 36 : -27) : 36}
                        fill={isBypassed ? "#fca5a5" : "#86efac"}
                        fontSize="8"
                        fontWeight="700"
                        letterSpacing="0.04em"
                        textAnchor="middle"
                      >
                        {isBypassed ? "BYPASSED" : "SERVED"}
                      </text>
                    </g>
                  );
                })}
              </>
            );
          })()}
        </svg>
      </div>

      {/* Schematic Legend & Station Detail Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          paddingTop: 12,
          borderTop: "1px solid rgba(148, 163, 184, 0.15)",
          fontSize: 11,
          color: "var(--text-3)",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 4, background: "#334155", borderRadius: 2 }} />
            <span>Scheduled Track</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 4, background: isSLW ? "#38bdf8" : isChord ? "#f59e0b" : "#ef4444", borderRadius: 2 }} />
            <span>Active Diversion Trajectory</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 10, background: "rgba(239, 68, 68, 0.6)", border: "1px solid #ef4444", borderRadius: 2 }} />
            <span>Blocked Sector</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", border: "2px solid #16a34a" }} />
            <span style={{ color: "#4ade80", fontWeight: 600 }}>Stoppage Preserved</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", border: "2px solid #dc2626" }} />
            <span style={{ color: "#f87171", fontWeight: 600 }}>Stoppage Skipped / Bypassed</span>
          </div>
        </div>

        {bypassedStops.size > 0 && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", padding: "4px 10px", borderRadius: 6, color: "#fca5a5", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} color="#ef4444" />
            <span><strong>{bypassedStops.size} Station(s) Bypassed:</strong> Passenger bus bridging protocol activated.</span>
          </div>
        )}
      </div>
    </div>
  );
}
