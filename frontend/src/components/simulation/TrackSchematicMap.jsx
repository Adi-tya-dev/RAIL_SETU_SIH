import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, ExternalLink, Compass } from "lucide-react";
import { navigate } from "../../hooks/useRoute";
import { useTheme } from "../../contexts/ThemeContext";

export default function TrackSchematicMap({ train, activeStrategy, emergencyEvent }) {
  const [hoveredStation, setHoveredStation] = useState(null);
  const { theme } = useTheme();
  const isDayMode = theme === "white";

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
    const bypassStr = (activeStrategy.reroute_path?.bypass_path || []).join(",");
    const params = new URLSearchParams({
      trainId: train.train_id,
      trainNumber: train.train_number,
      block: blockCode,
      strategy: activeStrategy.id,
      strategyName: activeStrategy.name,
      bypassed: (activeStrategy.stops_bypassed || []).join(","),
      served: (activeStrategy.stops_served || []).join(","),
      ...(bypassStr ? { bypassPath: bypassStr } : {}),
    });
    if (activeStrategy.reroute_path) {
      try {
        sessionStorage.setItem(`reroute_path_${train.train_id}`, JSON.stringify(activeStrategy.reroute_path));
        sessionStorage.setItem(`reroute_path_${train.train_number}`, JSON.stringify(activeStrategy.reroute_path));
      } catch (e) {}
    }
    navigate(`/map?${params.toString()}`);
  }

  // Theme-adaptive palette:
  // In day mode: clean architectural high-contrast drafting scheme.
  // In dark mode: sleek cockpit dark-sky scheme (preserved 100%).
  const c = isDayMode
    ? {
        cardBg: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        cardBorder: "1px solid #cbd5e1",
        cardShadow: "0 4px 20px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.05)",
        titleColor: "#0f172a",
        compassColor: "#0284c7",
        gisBtnBg: "#f0f9ff",
        gisBtnBorder: "1px solid #bae6fd",
        gisBtnColor: "#0284c7",
        gisBtnHoverBg: "#e0f2fe",
        gisBtnHoverBorder: "#7dd3fc",
        trackLabel: "#475569",
        trackBase: "#94a3b8",
        trackDash: "#64748b",
        hazardStripe1: "#ef4444",
        hazardStripe2: "#fee2e2",
        blockedBorder: "#dc2626",
        blockedBadgeBg: "#fee2e2",
        blockedBadgeBorder: "#ef4444",
        blockedBadgeText: "#b91c1c",
        divertLine: "#0284c7",
        turnoutText: "#0369a1",
        slwLine: "#16a34a",
        slwPillBg: "rgba(240, 253, 244, 0.96)",
        slwPillBorder: "#16a34a",
        slwPillText: "#15803d",
        chordLine: "#d97706",
        chordPillBg: "rgba(255, 251, 235, 0.96)",
        chordPillBorder: "#d97706",
        chordPillText: "#b45309",
        heldPillText: "#dc2626",
        // Stations
        servedHaloFill: "rgba(34, 197, 94, 0.16)",
        servedHaloStroke: "#16a34a",
        servedCore: "#16a34a",
        servedText: "#15803d",
        servedSubText: "#166534",
        bypassedHaloFill: "rgba(239, 68, 68, 0.16)",
        bypassedHaloStroke: "#dc2626",
        bypassedCore: "#dc2626",
        bypassedText: "#b91c1c",
        bypassedSubText: "#991b1b",
        // Legend & Footer
        legendText: "#475569",
        legendDivider: "1px solid #e2e8f0",
        legendScheduledTrack: "#94a3b8",
        legendPreservedText: "#15803d",
        legendSkippedText: "#b91c1c",
        bypassedAlertBg: "#fef2f2",
        bypassedAlertBorder: "1px solid #fecaca",
        bypassedAlertText: "#991b1b",
        bypassedAlertIcon: "#dc2626",
        // Header Strategy badges
        slwBadgeBg: "#dcfce7",
        slwBadgeText: "#15803d",
        slwBadgeBorder: "#86efac",
        chordBadgeBg: "#fef3c7",
        chordBadgeText: "#b45309",
        chordBadgeBorder: "#fcd34d",
        otherBadgeBg: "#f1f5f9",
        otherBadgeText: "#475569",
        otherBadgeBorder: "#cbd5e1",
      }
    : {
        cardBg: "radial-gradient(ellipse at 50% 0%, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))",
        cardBorder: "1px solid rgba(56, 189, 248, 0.25)",
        cardShadow: "0 6px 24px rgba(0, 0, 0, 0.3)",
        titleColor: "#f8fafc",
        compassColor: "#38bdf8",
        gisBtnBg: "rgba(56, 189, 248, 0.15)",
        gisBtnBorder: "1px solid rgba(56, 189, 248, 0.4)",
        gisBtnColor: "#38bdf8",
        gisBtnHoverBg: "rgba(56, 189, 248, 0.28)",
        gisBtnHoverBorder: "#38bdf8",
        trackLabel: "#64748b",
        trackBase: "#334155",
        trackDash: "#475569",
        hazardStripe1: "#ef4444",
        hazardStripe2: "#7f1d1d",
        blockedBorder: "#ef4444",
        blockedBadgeBg: "#7f1d1d",
        blockedBadgeBorder: "#ef4444",
        blockedBadgeText: "#fca5a5",
        divertLine: "#38bdf8",
        turnoutText: "#38bdf8",
        slwLine: "#22c55e",
        slwPillBg: "rgba(6, 20, 32, 0.94)",
        slwPillBorder: "#22c55e",
        slwPillText: "#4ade80",
        chordLine: "#f59e0b",
        chordPillBg: "rgba(24, 18, 5, 0.94)",
        chordPillBorder: "#f59e0b",
        chordPillText: "#fbbf24",
        heldPillText: "#f87171",
        // Stations
        servedHaloFill: "rgba(34, 197, 94, 0.25)",
        servedHaloStroke: "#22c55e",
        servedCore: "#16a34a",
        servedText: "#4ade80",
        servedSubText: "#86efac",
        bypassedHaloFill: "rgba(239, 68, 68, 0.25)",
        bypassedHaloStroke: "#ef4444",
        bypassedCore: "#dc2626",
        bypassedText: "#f87171",
        bypassedSubText: "#fca5a5",
        // Legend & Footer
        legendText: "var(--text-3)",
        legendDivider: "1px solid rgba(148, 163, 184, 0.15)",
        legendScheduledTrack: "#334155",
        legendPreservedText: "#4ade80",
        legendSkippedText: "#f87171",
        bypassedAlertBg: "rgba(239, 68, 68, 0.15)",
        bypassedAlertBorder: "1px solid rgba(239, 68, 68, 0.3)",
        bypassedAlertText: "#fca5a5",
        bypassedAlertIcon: "#ef4444",
        // Header Strategy badges
        slwBadgeBg: "rgba(34, 197, 94, 0.15)",
        slwBadgeText: "#4ade80",
        slwBadgeBorder: "rgba(34, 197, 94, 0.3)",
        chordBadgeBg: "rgba(245, 158, 11, 0.15)",
        chordBadgeText: "#fbbf24",
        chordBadgeBorder: "rgba(245, 158, 11, 0.3)",
        otherBadgeBg: "rgba(148, 163, 184, 0.15)",
        otherBadgeText: "#94a3b8",
        otherBadgeBorder: "rgba(148, 163, 184, 0.3)",
      };

  return (
    <div
      style={{
        marginTop: 16,
        padding: "16px 18px",
        background: c.cardBg,
        border: c.cardBorder,
        borderRadius: 10,
        boxShadow: c.cardShadow,
      }}
    >
      {/* Schematic Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Compass size={18} color={c.compassColor} />
          <strong style={{ fontSize: 13, color: c.titleColor, letterSpacing: 0.5 }}>
            ROUTE SCHEMATIC & TRACK TRAJECTORY
          </strong>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: isSLW ? c.slwBadgeBg : isChord ? c.chordBadgeBg : c.otherBadgeBg,
              color: isSLW ? c.slwBadgeText : isChord ? c.chordBadgeText : c.otherBadgeText,
              fontWeight: 600,
              border: `1px solid ${isSLW ? c.slwBadgeBorder : isChord ? c.chordBadgeBorder : c.otherBadgeBorder}`,
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
            background: c.gisBtnBg,
            border: c.gisBtnBorder,
            color: c.gisBtnColor,
            padding: "5px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = c.gisBtnHoverBg;
            e.currentTarget.style.borderColor = c.gisBtnHoverBorder;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = c.gisBtnBg;
            e.currentTarget.style.borderColor = c.gisBtnBorder;
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
              <line x1="0" y1="0" x2="0" y2="12" stroke={c.hazardStripe1} strokeWidth="4" />
              <line x1="6" y1="0" x2="6" y2="12" stroke={c.hazardStripe2} strokeWidth="4" />
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
          <text x="15" y="44" fill={c.trackLabel} fontSize="11" fontFamily="monospace" fontWeight="600">MAIN LINE (UP)</text>
          <text x="15" y="134" fill={c.trackLabel} fontSize="11" fontFamily="monospace" fontWeight="600">
            {isSLW ? "PARALLEL TRACK (DOWN / SLW)" : isChord ? "OUTER CHORD BYPASS LINE" : "LOOP LINE SIDING"}
          </text>

          {/* MAIN LINE (Track 1) */}
          <line x1="130" y1="50" x2="890" y2="50" stroke={c.trackBase} strokeWidth="6" strokeLinecap="round" />
          <line x1="130" y1="50" x2="890" y2="50" stroke={c.trackDash} strokeWidth="2" strokeDasharray="3 6" />

          {/* PARALLEL TRACK BASELINE (Track 2) */}
          <line x1="130" y1="140" x2="890" y2="140" stroke={c.trackBase} strokeWidth="6" strokeLinecap="round" />
          <line x1="130" y1="140" x2="890" y2="140" stroke={c.trackDash} strokeWidth="2" strokeDasharray="3 6" />

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
                  stroke={c.blockedBorder}
                  strokeWidth="1.5"
                  rx="4"
                />
                {/* Blocked Sector Top Callout Badge */}
                <g transform={`translate(${(blockStartX + blockEndX) / 2}, 16)`}>
                  <rect x="-80" y="-10" width="160" height="18" rx="9" fill={c.blockedBadgeBg} stroke={c.blockedBadgeBorder} strokeWidth="1" />
                  <text x="0" y="3" fill={c.blockedBadgeText} fontSize="9.5" fontWeight="700" textAnchor="middle">
                    🛑 BLOCKED: {blockCode} ({duration}m)
                  </text>
                </g>

                {/* DIVERSION / REROUTE TRAJECTORY */}
                {isSLW && (
                  <g>
                    {/* Approaching main track */}
                    <line x1="130" y1="50" x2={divX} y2="50" stroke={c.divertLine} strokeWidth="4" strokeLinecap="round" />
                    
                    {/* Crossover 1: Main -> Parallel Track */}
                    <path
                      d={`M ${divX} 50 C ${divX + 25} 50, ${divX + 25} 140, ${divX + 50} 140`}
                      fill="none"
                      stroke={c.divertLine}
                      strokeWidth="4"
                      strokeDasharray="5 3"
                    />
                    <circle cx={divX} cy="50" r="4" fill={c.divertLine} />
                    <text x={divX} y="38" fill={c.turnoutText} fontSize="8.5" textAnchor="middle" fontWeight="600">Turnout 1</text>

                    {/* SLW Section along parallel track */}
                    <line x1={divX + 50} y1="140" x2={convX - 50} y2="140" stroke={c.slwLine} strokeWidth="5" strokeLinecap="round" />
                    
                    {/* Label Placement: If stations exist below, position in gap above parallel track (y = 95). If no stations below, write below parallel track (y = 165) */}
                    {hasStopsBelow ? (
                      <g transform={`translate(${(divX + convX) / 2}, 95)`}>
                        <rect
                          x="-185"
                          y="-12"
                          width="370"
                          height="24"
                          rx="12"
                          fill={c.slwPillBg}
                          stroke={c.slwPillBorder}
                          strokeWidth="1.2"
                        />
                        <text
                          x="0"
                          y="4.5"
                          fill={c.slwPillText}
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
                        fill={c.slwPillText}
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
                      stroke={c.divertLine}
                      strokeWidth="4"
                      strokeDasharray="5 3"
                    />
                    <circle cx={convX} cy="50" r="4" fill={c.divertLine} />
                    <text x={convX} y="38" fill={c.turnoutText} fontSize="8.5" textAnchor="middle" fontWeight="600">Turnout 2</text>

                    {/* Continuing on Main Track */}
                    <line x1={convX} y1="50" x2="890" y2="50" stroke={c.divertLine} strokeWidth="4" strokeLinecap="round" />
                  </g>
                )}

                {isChord && (
                  <g>
                    {/* Approaching main track before chord branch */}
                    <line x1="130" y1="50" x2={divX} y2="50" stroke={c.divertLine} strokeWidth="4" strokeLinecap="round" />

                    {/* Chord line divergence branch */}
                    <path
                      d={`M ${divX} 50 C ${divX + 35} 50, ${divX + 25} 140, ${divX + 50} 140`}
                      fill="none"
                      stroke={c.chordLine}
                      strokeWidth="4"
                      strokeDasharray="6 3"
                    />
                    <circle cx={divX} cy="50" r="5" fill={c.chordLine} />
                    <text x={divX} y="38" fill={c.chordPillText} fontSize="8.5" textAnchor="middle" fontWeight="600">Chord Divergence</text>

                    {/* Chord line bypass track */}
                    <line x1={divX + 50} y1="140" x2={convX - 50} y2="140" stroke={c.chordLine} strokeWidth="4" strokeLinecap="round" />
                    
                    {/* Label Placement: If stations exist below, position in gap above parallel track (y = 95). If no stations below, write below parallel track (y = 165) */}
                    {hasStopsBelow ? (
                      <g transform={`translate(${(divX + convX) / 2}, 95)`}>
                        <rect
                          x="-170"
                          y="-12"
                          width="340"
                          height="24"
                          rx="12"
                          fill={c.chordPillBg}
                          stroke={c.chordPillBorder}
                          strokeWidth="1.2"
                        />
                        <text
                          x="0"
                          y="4.5"
                          fill={c.chordPillText}
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
                        fill={c.chordPillText}
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
                      stroke={c.chordLine}
                      strokeWidth="4"
                      strokeDasharray="6 3"
                    />
                    <circle cx={convX} cy="50" r="5" fill={c.chordLine} />
                    <text x={convX} y="38" fill={c.chordPillText} fontSize="8.5" textAnchor="middle" fontWeight="600">Rejoins Main Line</text>

                    {/* Continuing on Main Line */}
                    <line x1={convX} y1="50" x2="890" y2="50" stroke={c.divertLine} strokeWidth="4" strokeLinecap="round" />
                  </g>
                )}

                {isHold && (
                  <g>
                    <line x1="130" y1="50" x2={divX} y2="50" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                    <rect x={divX} y="38" width="12" height="24" fill="#ef4444" rx="2" />
                    <text x={divX} y="32" fill={c.heldPillText} fontSize="10" textAnchor="middle" fontWeight="700">
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
                        fill={isBypassed ? c.bypassedHaloFill : c.servedHaloFill}
                        stroke={isBypassed ? c.bypassedHaloStroke : c.servedHaloStroke}
                        strokeWidth={isBypassed ? 2.5 : 2}
                        filter={isBypassed ? "url(#red-glow)" : "url(#cyan-glow)"}
                      />

                      {/* Station Inner Core */}
                      <circle
                        cx="0"
                        cy="0"
                        r={isBypassed ? 5.5 : 4.5}
                        fill={isBypassed ? c.bypassedCore : c.servedCore}
                      />

                      {/* Station Code Label */}
                      <text
                        x="0"
                        y={yPos === 50 ? (isBypassed ? 25 : -16) : 25}
                        fill={isBypassed ? c.bypassedText : c.servedText}
                        fontSize="11"
                        fontWeight="800"
                        textAnchor="middle"
                        fontFamily="system-ui, sans-serif"
                      >
                        {isBypassed ? `⚠ ${stationCode}` : `✓ ${stationCode}`}
                      </text>

                      {/* Status Sub-badge */}
                      <text
                        x="0"
                        y={yPos === 50 ? (isBypassed ? 36 : -27) : 36}
                        fill={isBypassed ? c.bypassedSubText : c.servedSubText}
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
          borderTop: c.legendDivider,
          fontSize: 11,
          color: c.legendText,
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 4, background: c.legendScheduledTrack, borderRadius: 2 }} />
            <span>Scheduled Track</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 4, background: isSLW ? c.divertLine : isChord ? c.chordLine : "#ef4444", borderRadius: 2 }} />
            <span>Active Diversion Trajectory</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 10, background: isDayMode ? "#fee2e2" : "rgba(239, 68, 68, 0.6)", border: `1px solid ${c.blockedBorder}`, borderRadius: 2 }} />
            <span>Blocked Sector</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.servedCore, border: `2px solid ${c.servedHaloStroke}` }} />
            <span style={{ color: c.legendPreservedText, fontWeight: 600 }}>Stoppage Preserved</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.bypassedCore, border: `2px solid ${c.bypassedHaloStroke}` }} />
            <span style={{ color: c.legendSkippedText, fontWeight: 600 }}>Stoppage Skipped / Bypassed</span>
          </div>
        </div>

        {bypassedStops.size > 0 && (
          <div style={{ background: c.bypassedAlertBg, border: c.bypassedAlertBorder, padding: "4px 10px", borderRadius: 6, color: c.bypassedAlertText, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} color={c.bypassedAlertIcon} />
            <span><strong>{bypassedStops.size} Station(s) Bypassed:</strong> Passenger bus bridging protocol activated.</span>
          </div>
        )}
      </div>
    </div>
  );
}
