import { useState, useEffect, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Zap,
  MapPin,
  Calendar,
  Layers,
  Info,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  LayoutGrid,
  List,
} from "lucide-react";
import { apiRequest } from "../api/client";
import { navigate } from "../hooks/useRoute";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Drawer from "../components/common/Drawer";

// Status definitions & color schemas
export const SLOT_STATUS = {
  FREE: {
    key: "FREE",
    label: "Free / Available",
    badgeTone: "green",
    color: "var(--green, #10b981)",
    border: "rgba(16, 185, 129, 0.35)",
    bg: "rgba(16, 185, 129, 0.08)",
    glow: "0 0 16px rgba(16, 185, 129, 0.15)",
    description: "Ample gap (≥ 60 min) with full capacity ready for maintenance booking.",
  },
  ASSIGNED: {
    key: "ASSIGNED",
    label: "Assigned / Booked",
    badgeTone: "blue",
    color: "var(--blue, #38bdf8)",
    border: "rgba(56, 189, 248, 0.35)",
    bg: "rgba(56, 189, 248, 0.08)",
    glow: "0 0 16px rgba(56, 189, 248, 0.15)",
    description: "Work Package scheduled into this window. Track possession planned.",
  },
  DURATION_DEFICIT: {
    key: "DURATION_DEFICIT",
    label: "Duration Deficit (< 60m)",
    badgeTone: "amber",
    color: "var(--amber, #f59e0b)",
    border: "rgba(245, 158, 11, 0.35)",
    bg: "rgba(245, 158, 11, 0.08)",
    glow: "0 0 16px rgba(245, 158, 11, 0.15)",
    description: "Gap is too short (< 60 min) for mechanized maintenance mobilization and clearance.",
  },
  RESTRICTED: {
    key: "RESTRICTED",
    label: "Restricted / Corridor",
    badgeTone: "purple",
    color: "var(--violet, #8b5cf6)",
    border: "rgba(139, 92, 246, 0.35)",
    bg: "rgba(139, 92, 246, 0.08)",
    glow: "0 0 16px rgba(139, 92, 246, 0.15)",
    description: "Corridor-wide availability window or single-block constrained boundary.",
  },
};

export default function TimetableSlots() {
  const [windows, setWindows] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Controls
  const [filterTab, setFilterTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [sortBy, setSortBy] = useState("DURATION_DESC");
  const [viewMode, setViewMode] = useState("GRID"); // "GRID" | "TABLE"
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Read search param from hash if available (e.g. #/slots?id=GAP_1_1)
  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash.includes("?")) {
      const params = new URLSearchParams(hash.split("?")[1]);
      const initialSearch = params.get("search") || params.get("id");
      if (initialSearch) {
        setSearchQuery(initialSearch);
      }
    }
  }, []);

  // Fetch windows and optimizer schedules
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 1. Check if cached optimizer result exists in sessionStorage
      let cachedSchedules = [];
      try {
        const cachedRaw = sessionStorage.getItem("railsetu_last_optimizer_result");
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed?.schedules && Array.isArray(parsed.schedules)) {
            cachedSchedules = parsed.schedules;
          }
        }
      } catch (e) {
        console.warn("Could not read cached optimizer result:", e);
      }

      // 2. Fetch live COA windows and weekly plans concurrently in parallel
      const needWeekly = cachedSchedules.length === 0 || isManualRefresh;
      const [winRes, weeklyRes] = await Promise.all([
        apiRequest("/v1/block-planning/windows").catch((e) => {
          console.warn("Could not fetch windows:", e);
          return { data: [] };
        }),
        needWeekly
          ? apiRequest("/v1/block-planning/weekly").catch((e) => {
              console.warn("Could not fetch weekly plans:", e);
              return { data: [] };
            })
          : Promise.resolve({ data: [] }),
      ]);

      const fetchedWindows = winRes.data || [];
      const weeklyPlans = weeklyRes.data || [];

      if (weeklyPlans.length > 0 && cachedSchedules.length === 0) {
        // Map weekly plans into schedule format
        cachedSchedules = weeklyPlans.map((wp) => ({
          package_id: `PLAN_${wp.plan_id}`,
          assigned_window: wp.assigned_window || `COA_AVAIL_B00${wp.block_id}`,
          duration_needed_mins: wp.duration_minutes || 120,
          description: wp.adjustment_reason || `Maintenance Plan #${wp.plan_id}`,
          block_codes: wp.block?.block_code ? [wp.block.block_code] : [],
          section_codes: wp.block?.track?.section?.section_code ? [wp.block.track.section.section_code] : [],
          status: "ASSIGNED",
        }));
      }

      setWindows(fetchedWindows);
      setSchedules(cachedSchedules);
    } catch (err) {
      console.error("Failed to load timetable slots:", err);
      setError(err.message || "Could not load timetable windows");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute enriched slot data with status, allocated packages, and utilization metrics
  const enrichedSlots = useMemo(() => {
    // Build map of window assignments
    const assignmentsByWindow = new Map();
    for (const s of schedules) {
      if (s.assigned_window && s.status === "ASSIGNED") {
        if (!assignmentsByWindow.has(s.assigned_window)) {
          assignmentsByWindow.set(s.assigned_window, []);
        }
        assignmentsByWindow.get(s.assigned_window).push(s);
      }
    }

    return windows.map((w) => {
      const assignedPkgs = assignmentsByWindow.get(w.id) || [];
      const totalBookedMins = assignedPkgs.reduce(
        (sum, p) => sum + (p.duration_needed_mins || p.total_duration_required || 0),
        0
      );
      const isAssigned = assignedPkgs.length > 0;
      const remainingMins = Math.max(0, (w.duration_mins || 0) - totalBookedMins);
      const utilizationPct = w.duration_mins > 0
        ? Math.min(100, Math.round((totalBookedMins / w.duration_mins) * 100))
        : 0;

      // Status classification
      let statusKey = "FREE";
      if (isAssigned) {
        statusKey = "ASSIGNED";
      } else if (w.duration_mins < 60) {
        statusKey = "DURATION_DEFICIT";
      } else if (w.source === "COA_BLOCK_AVAILABILITY" || w.is_corridor_window) {
        statusKey = "RESTRICTED";
      } else {
        statusKey = "FREE";
      }

      const statusMeta = SLOT_STATUS[statusKey];

      // Formatted durations
      const hours = Math.floor(w.duration_mins / 60);
      const mins = w.duration_mins % 60;
      const formattedDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      return {
        ...w,
        statusKey,
        statusMeta,
        isAssigned,
        assignedPkgs,
        totalBookedMins,
        remainingMins,
        utilizationPct,
        formattedDuration,
        primarySection: w.section_codes?.[0] || "SEC-GENERAL",
      };
    });
  }, [windows, schedules]);

  // Extract unique sections for filter dropdown
  const availableSections = useMemo(() => {
    const set = new Set();
    enrichedSlots.forEach((s) => {
      if (s.section_codes) {
        s.section_codes.forEach((sc) => set.add(sc));
      }
    });
    return Array.from(set).sort();
  }, [enrichedSlots]);

  // Aggregate Statistics for Scorecards
  const stats = useMemo(() => {
    const total = enrichedSlots.length;
    const free = enrichedSlots.filter((s) => s.statusKey === "FREE");
    const assigned = enrichedSlots.filter((s) => s.statusKey === "ASSIGNED");
    const deficit = enrichedSlots.filter((s) => s.statusKey === "DURATION_DEFICIT");
    const restricted = enrichedSlots.filter((s) => s.statusKey === "RESTRICTED");

    const totalCapacityMins = enrichedSlots.reduce((sum, s) => sum + (s.duration_mins || 0), 0);
    const totalFreeMins = free.reduce((sum, s) => sum + s.duration_mins, 0);
    const totalBookedMins = enrichedSlots.reduce((sum, s) => sum + s.totalBookedMins, 0);

    return {
      total,
      freeCount: free.length,
      assignedCount: assigned.length,
      deficitCount: deficit.length,
      restrictedCount: restricted.length,
      totalCapacityHours: (totalCapacityMins / 60).toFixed(1),
      totalFreeHours: (totalFreeMins / 60).toFixed(1),
      totalBookedHours: (totalBookedMins / 60).toFixed(1),
      utilizationRate: totalCapacityMins > 0 ? Math.round((totalBookedMins / totalCapacityMins) * 100) : 0,
    };
  }, [enrichedSlots]);

  // Filter & Sort Slots
  const filteredSlots = useMemo(() => {
    return enrichedSlots
      .filter((slot) => {
        // Tab filter
        if (filterTab !== "ALL" && slot.statusKey !== filterTab) {
          return false;
        }

        // Section filter
        if (selectedSection !== "ALL") {
          const match = slot.section_codes?.includes(selectedSection);
          if (!match) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchId = slot.id.toLowerCase().includes(q);
          const matchLabel = slot.label?.toLowerCase().includes(q);
          const matchBlock = slot.block_code?.toLowerCase().includes(q);
          const matchSection = slot.section_codes?.some((sc) => sc.toLowerCase().includes(q));
          const matchPkg = slot.assignedPkgs?.some(
            (p) =>
              p.package_id?.toLowerCase().includes(q) ||
              p.description?.toLowerCase().includes(q)
          );
          if (!matchId && !matchLabel && !matchBlock && !matchSection && !matchPkg) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "DURATION_DESC") return b.duration_mins - a.duration_mins;
        if (sortBy === "DURATION_ASC") return a.duration_mins - b.duration_mins;
        if (sortBy === "START_TIME") {
          const tA = a.gap_start ? new Date(a.gap_start).getTime() : 0;
          const tB = b.gap_start ? new Date(b.gap_start).getTime() : 0;
          return tA - tB;
        }
        if (sortBy === "UTILIZATION_DESC") return b.utilizationPct - a.utilizationPct;
        if (sortBy === "STATUS") return a.statusKey.localeCompare(b.statusKey);
        return 0;
      });
  }, [enrichedSlots, filterTab, selectedSection, searchQuery, sortBy]);

  return (
    <div className="page" style={{ paddingBottom: 48 }}>
      {/* Breadcrumbs Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--text-3)",
          marginBottom: 12,
        }}
      >
        <span
          style={{ cursor: "pointer", color: "var(--text-2)" }}
          onClick={() => navigate("/dashboard")}
        >
          RailSetu
        </span>
        <span>›</span>
        <span
          style={{ cursor: "pointer", color: "var(--text-2)" }}
          onClick={() => navigate("/ml-planning")}
        >
          ML Pipeline Optimizer
        </span>
        <span>›</span>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>
          Timetable Slots & Maintenance Windows
        </span>
      </div>

      {/* Page Header with Action Buttons */}
      <PageHeader
        title="Timetable Slots & Maintenance Windows"
        subtitle="Live multi-status explorer for network timetable gaps: available free slots, booked maintenance windows, and duration-constrained slots."
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate("/ml-planning")}
            >
              Back to ML Optimizer
            </Button>

            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadData(true)}
              title="Refresh timetable windows from COA and live database"
            >
              Refresh
            </Button>

            <Button
              variant="primary"
              icon={Zap}
              onClick={() => navigate("/ml-planning")}
            >
              Run ML Optimizer
            </Button>
          </div>
        }
      />

      {/* KPI Summary Scoreboard */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* Total Windows */}
        <div
          className="card"
          style={{
            padding: "16px 18px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Network Slots
            </span>
            <Clock size={18} color="var(--text-3)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", marginTop: 6 }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
            {stats.totalCapacityHours} total track hours tracked
          </div>
        </div>

        {/* Free / Available Slots */}
        <div
          className="card"
          onClick={() => setFilterTab("FREE")}
          style={{
            padding: "16px 18px",
            background: "rgba(16, 185, 129, 0.06)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 10,
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🟢 Free / Ready Slots
            </span>
            <CheckCircle2 size={18} color="var(--green)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green)", marginTop: 6 }}>
            {stats.freeCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            {stats.totalFreeHours} hrs available for dispatch
          </div>
        </div>

        {/* Assigned Slots */}
        <div
          className="card"
          onClick={() => setFilterTab("ASSIGNED")}
          style={{
            padding: "16px 18px",
            background: "rgba(56, 189, 248, 0.06)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: 10,
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🔵 Assigned / Booked
            </span>
            <Layers size={18} color="var(--blue)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--blue)", marginTop: 6 }}>
            {stats.assignedCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            {stats.totalBookedHours} hrs scheduled ({stats.utilizationRate}% capacity)
          </div>
        </div>

        {/* Duration Deficit Slots */}
        <div
          className="card"
          onClick={() => setFilterTab("DURATION_DEFICIT")}
          style={{
            padding: "16px 18px",
            background: "rgba(245, 158, 11, 0.06)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: 10,
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🟠 Duration Deficit
            </span>
            <AlertTriangle size={18} color="var(--amber)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--amber)", marginTop: 6 }}>
            {stats.deficitCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            &lt; 60 min (cannot fit heavy machinery)
          </div>
        </div>

        {/* Restricted / Corridor Windows */}
        <div
          className="card"
          onClick={() => setFilterTab("RESTRICTED")}
          style={{
            padding: "16px 18px",
            background: "rgba(139, 92, 246, 0.06)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: 10,
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--violet)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🟣 Restricted / Corridor
            </span>
            <Lock size={18} color="var(--violet)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--violet)", marginTop: 6 }}>
            {stats.restrictedCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            Single-block or joint corridor slots
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card__body" style={{ padding: "14px 18px" }}>
          {/* Status Tabs */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 14,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 12,
            }}
          >
            {[
              { key: "ALL", label: `All Slots (${stats.total})`, color: "var(--text)" },
              { key: "FREE", label: `🟢 Free (${stats.freeCount})`, color: "var(--green)" },
              { key: "ASSIGNED", label: `🔵 Assigned (${stats.assignedCount})`, color: "var(--blue)" },
              { key: "DURATION_DEFICIT", label: `🟠 Duration Deficit (< 60m) (${stats.deficitCount})`, color: "var(--amber)" },
              { key: "RESTRICTED", label: `🟣 Restricted (${stats.restrictedCount})`, color: "var(--violet)" },
            ].map((tab) => {
              const active = filterTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    border: active ? `1.5px solid ${tab.color}` : "1px solid var(--border)",
                    background: active ? "var(--surface-3)" : "var(--surface-2)",
                    color: active ? tab.color : "var(--text-2)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search, Section & Sort Toolbar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: 260, flex: "1 1 280px" }}>
              <Search
                size={16}
                color="var(--text-3)"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                className="input"
                placeholder="Search by ID (GAP_1_1), block, section, or time..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 36, width: "100%", height: 38 }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-3)",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Section Filter Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>Section:</span>
              <select
                className="select"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                style={{ height: 38, minWidth: 150 }}
              >
                <option value="ALL">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>Sort:</span>
              <select
                className="select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ height: 38, minWidth: 160 }}
              >
                <option value="DURATION_DESC">Longest Duration</option>
                <option value="DURATION_ASC">Shortest Duration</option>
                <option value="START_TIME">Chronological Start</option>
                <option value="UTILIZATION_DESC">Highest Utilization</option>
                <option value="STATUS">Status Type</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 6, padding: 3, border: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 4,
                  border: "none",
                  background: viewMode === "GRID" ? "var(--surface-3)" : "transparent",
                  color: viewMode === "GRID" ? "var(--accent)" : "var(--text-3)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                }}
              >
                <LayoutGrid size={14} /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 4,
                  border: "none",
                  background: viewMode === "TABLE" ? "var(--surface-3)" : "transparent",
                  color: viewMode === "TABLE" ? "var(--accent)" : "var(--text-3)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                }}
              >
                <List size={14} /> Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          marginBottom: 16,
          padding: "8px 16px",
          background: "var(--surface)",
          borderRadius: 8,
          border: "1px solid var(--border)",
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text-2)" }}>Color Key:</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--green)" }} />
          <span style={{ color: "var(--text-2)" }}>🟢 <strong>Free Slot</strong> (≥60m, ready for work)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--blue)" }} />
          <span style={{ color: "var(--text-2)" }}>🔵 <strong>Assigned Window</strong> (allocated to Work Package)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--amber)" }} />
          <span style={{ color: "var(--text-2)" }}>🟠 <strong>Duration Deficit</strong> (&lt;60m, cannot fit heavy machinery)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--violet)" }} />
          <span style={{ color: "var(--text-2)" }}>🟣 <strong>Restricted / Corridor</strong> (special access slot)</span>
        </div>
      </div>

      {/* Results Count */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "var(--text-3)" }}>
          Showing <strong>{filteredSlots.length}</strong> of <strong>{enrichedSlots.length}</strong> slots
          {filterTab !== "ALL" && ` (filtered by ${SLOT_STATUS[filterTab]?.label || filterTab})`}
          {selectedSection !== "ALL" && ` · Section: ${selectedSection}`}
          {searchQuery && ` · matching "${searchQuery}"`}
        </span>
        {(searchQuery || selectedSection !== "ALL" || filterTab !== "ALL") && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedSection("ALL");
              setFilterTab("ALL");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>
          <RefreshCw size={28} className="spin" style={{ marginBottom: 12, color: "var(--accent)" }} />
          <p>Loading network timetable slots and availability windows...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div
          className="card"
          style={{
            padding: 24,
            border: "1px solid rgba(239, 68, 68, 0.4)",
            background: "rgba(239, 68, 68, 0.08)",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--red)" }}>
            <ShieldAlert size={20} />
            <strong>Failed to fetch timetable slots:</strong> {error}
          </div>
          <div style={{ marginTop: 12 }}>
            <Button size="sm" onClick={() => loadData()}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredSlots.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
          <Clock size={36} style={{ marginBottom: 12, color: "var(--text-4)" }} />
          <h3 style={{ color: "var(--text-2)", marginBottom: 6 }}>No matching timetable slots found</h3>
          <p style={{ fontSize: 13, maxWidth: 420, margin: "0 auto 16px" }}>
            Try adjusting your search terms or filter selection to see available maintenance windows.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSearchQuery("");
              setSelectedSection("ALL");
              setFilterTab("ALL");
            }}
          >
            Reset All Filters
          </Button>
        </div>
      )}

      {/* GRID VIEW */}
      {!loading && !error && viewMode === "GRID" && filteredSlots.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: 14,
          }}
        >
          {filteredSlots.map((slot) => {
            const meta = slot.statusMeta;
            return (
              <div
                key={slot.id}
                onClick={() => setSelectedSlot(slot)}
                style={{
                  background: meta.bg,
                  border: `1.5px solid ${meta.border}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.18s ease",
                  boxShadow: meta.glow,
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = meta.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.borderColor = meta.border;
                }}
              >
                {/* Status Indicator Bar on top */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: meta.color,
                  }}
                />

                {/* Card Top: ID and Status Badge */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          fontFamily: "var(--mono)",
                          color: meta.color,
                        }}
                      >
                        {slot.id}
                      </span>
                      {slot.block_code && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--surface-3)",
                            color: "var(--text-2)",
                            fontWeight: 600,
                          }}
                        >
                          Block {slot.block_code}
                        </span>
                      )}
                    </div>

                    <Badge tone={meta.badgeTone} dot>
                      {meta.label}
                    </Badge>
                  </div>

                  {/* Duration and Time Span */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                      {slot.duration_mins} min{" "}
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-3)" }}>
                        ({slot.formattedDuration})
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={13} color="var(--text-3)" />
                      <span>{slot.label}</span>
                    </div>
                  </div>

                  {/* Section Badges */}
                  {slot.section_codes && slot.section_codes.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                      {slot.section_codes.map((sc) => (
                        <span
                          key={sc}
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--surface-2)",
                            color: "var(--text-3)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          Section: {sc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Bottom: Status Specific Content */}
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  {/* Case 1: ASSIGNED */}
                  {slot.statusKey === "ASSIGNED" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>
                        <span>Booked: <strong>{slot.totalBookedMins}m</strong> / {slot.duration_mins}m</span>
                        <span style={{ color: meta.color, fontWeight: 600 }}>{slot.utilizationPct}% Utilized</span>
                      </div>
                      {/* Capacity Bar */}
                      <div style={{ height: 6, width: "100%", background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${slot.utilizationPct}%`,
                            background: meta.color,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                        Allocated to:{" "}
                        <strong style={{ color: "var(--blue)" }}>
                          {slot.assignedPkgs.map((p) => p.package_id).join(", ")}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Case 2: DURATION DEFICIT */}
                  {slot.statusKey === "DURATION_DEFICIT" && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--amber)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 6,
                        lineHeight: 1.4,
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>
                        <strong>Cannot be assigned:</strong> Duration ({slot.duration_mins}m) &lt; 60m minimum needed for machine transit, setup & clearance.
                      </span>
                    </div>
                  )}

                  {/* Case 3: FREE / AVAILABLE */}
                  {slot.statusKey === "FREE" && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--green)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <CheckCircle2 size={14} />
                        <span>Ready for possession dispatch</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>Full Capacity</span>
                    </div>
                  )}

                  {/* Case 4: RESTRICTED */}
                  {slot.statusKey === "RESTRICTED" && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--violet)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Lock size={14} />
                      <span>COA corridor window · joint possession clearance</span>
                    </div>
                  )}

                  {/* Click to inspect prompt */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 2,
                      marginTop: 8,
                      fontSize: 11,
                      color: meta.color,
                      fontWeight: 600,
                    }}
                  >
                    <span>Inspect slot details</span>
                    <ChevronRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {!loading && !error && viewMode === "TABLE" && filteredSlots.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Window ID</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Time Span (Start – End)</th>
                  <th>Block Code</th>
                  <th>Section</th>
                  <th>Allocation / Capacity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlots.map((slot) => {
                  const meta = slot.statusMeta;
                  return (
                    <tr
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: meta.color }}>
                          {slot.id}
                        </span>
                      </td>
                      <td>
                        <Badge tone={meta.badgeTone} dot>
                          {meta.label}
                        </Badge>
                      </td>
                      <td>
                        <strong>{slot.duration_mins} min</strong>{" "}
                        <span className="text-faint text-xs">({slot.formattedDuration})</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Clock size={12} color="var(--text-3)" />
                          <span>{slot.label}</span>
                        </div>
                      </td>
                      <td>
                        {slot.block_code ? (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                            {slot.block_code}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 12 }}>{slot.primarySection}</span>
                      </td>
                      <td>
                        {slot.statusKey === "ASSIGNED" && (
                          <div style={{ minWidth: 140 }}>
                            <div style={{ fontSize: 11, display: "flex", justifyContent: "space-between" }}>
                              <span>{slot.totalBookedMins}m booked</span>
                              <strong style={{ color: meta.color }}>{slot.utilizationPct}%</strong>
                            </div>
                            <div style={{ height: 4, width: "100%", background: "var(--surface-3)", borderRadius: 2, marginTop: 3 }}>
                              <div style={{ height: "100%", width: `${slot.utilizationPct}%`, background: meta.color, borderRadius: 2 }} />
                            </div>
                          </div>
                        )}
                        {slot.statusKey === "FREE" && (
                          <span style={{ color: "var(--green)", fontSize: 12, fontWeight: 600 }}>
                            100% Free Capacity
                          </span>
                        )}
                        {slot.statusKey === "DURATION_DEFICIT" && (
                          <span style={{ color: "var(--amber)", fontSize: 11 }}>
                            ⚠ &lt; 60m (unusable for machinery)
                          </span>
                        )}
                        {slot.statusKey === "RESTRICTED" && (
                          <span style={{ color: "var(--violet)", fontSize: 11 }}>
                            Corridor Slot
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--sm btn--secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlot(slot);
                          }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECTOR SLIDE-OVER DRAWER */}
      <Drawer
        open={Boolean(selectedSlot)}
        onClose={() => setSelectedSlot(null)}
        title={selectedSlot ? `Window ${selectedSlot.id}` : "Window Details"}
        subtitle={selectedSlot ? `${selectedSlot.duration_mins} min • ${selectedSlot.label}` : ""}
        width={480}
      >
        {selectedSlot && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Status Banner */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: selectedSlot.statusMeta.bg,
                border: `1px solid ${selectedSlot.statusMeta.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: selectedSlot.statusMeta.color, fontSize: 14 }}>
                  {selectedSlot.statusMeta.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  {selectedSlot.statusMeta.description}
                </div>
              </div>
              <Badge tone={selectedSlot.statusMeta.badgeTone} dot>
                {selectedSlot.statusKey}
              </Badge>
            </div>

            {/* Timetable Identity & Timestamps */}
            <div className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "var(--text)" }}>
                Timetable Slot Telemetry
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                <div>
                  <span className="text-faint">Window ID:</span>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, marginTop: 2 }}>
                    {selectedSlot.id}
                  </div>
                </div>
                <div>
                  <span className="text-faint">Total Duration:</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>
                    {selectedSlot.duration_mins} mins ({selectedSlot.formattedDuration})
                  </div>
                </div>
                <div>
                  <span className="text-faint">Block Code:</span>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, marginTop: 2 }}>
                    {selectedSlot.block_code || "Network Wide"}
                  </div>
                </div>
                <div>
                  <span className="text-faint">Section:</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>
                    {selectedSlot.primarySection}
                  </div>
                </div>
                <div>
                  <span className="text-faint">Gap Start:</span>
                  <div style={{ fontSize: 11, marginTop: 2, fontFamily: "var(--mono)" }}>
                    {selectedSlot.gap_start ? new Date(selectedSlot.gap_start).toLocaleString() : "Not declared"}
                  </div>
                </div>
                <div>
                  <span className="text-faint">Gap End:</span>
                  <div style={{ fontSize: 11, marginTop: 2, fontFamily: "var(--mono)" }}>
                    {selectedSlot.gap_end ? new Date(selectedSlot.gap_end).toLocaleString() : "Not declared"}
                  </div>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <span className="text-faint">Slot Source:</span>
                  <div style={{ marginTop: 2 }}>
                    {selectedSlot.source === "TRAIN_GAP" ? (
                      <span style={{ color: "var(--text-2)" }}>
                        🚂 <strong>Train Movement Timetable Gap</strong> (calculated from live train timetables)
                      </span>
                    ) : (
                      <span style={{ color: "var(--violet)" }}>
                        🏛 <strong>COA Daily Maintenance Availability</strong> (official corridor slot)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Engineering & Mobilization Assessment */}
            <div className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "var(--text)" }}>
                Engineering Feasibility Evaluation
              </div>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-faint">Machine Mobilization Dead-Time (T_dead):</span>
                  <span><strong>~20-30 mins</strong> (transit + track earthing)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-faint">Track Possession Setup (T_setup):</span>
                  <span><strong>10 mins</strong> (flagging & detonators)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-faint">Safety Clearance Buffer (T_buffer):</span>
                  <span><strong>15 mins</strong> before next train entry</span>
                </div>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>Usable Wrench Time:</span>
                  <strong style={{ color: selectedSlot.duration_mins >= 60 ? "var(--green)" : "var(--amber)" }}>
                    {Math.max(0, selectedSlot.duration_mins - 45)} mins
                  </strong>
                </div>

                {selectedSlot.duration_mins < 60 && (
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      marginTop: 6,
                      color: "var(--amber)",
                      fontSize: 11,
                    }}
                  >
                    <strong>Why this slot has a duration deficit:</strong> Standard mechanized maintenance cannot safely operate in slots under 60 minutes because transit, setup, track isolation, and safety clearing require a minimum baseline buffer of 45-60 minutes.
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Work Packages (If Assigned) */}
            {selectedSlot.statusKey === "ASSIGNED" && (
              <div className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "var(--blue)" }}>
                  Scheduled Work Packages ({selectedSlot.assignedPkgs.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selectedSlot.assignedPkgs.map((pkg) => (
                    <div
                      key={pkg.package_id}
                      style={{
                        padding: "10px 12px",
                        background: "var(--surface-3)",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontFamily: "var(--mono)", color: "var(--accent)" }}>
                          {pkg.package_id}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {pkg.duration_needed_mins} mins needed
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text)", marginTop: 4 }}>
                        {pkg.description || "Track Possession Maintenance"}
                      </div>
                      {pkg.departments_involved && (
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          {pkg.departments_involved.map((dept) => (
                            <Badge key={dept} tone="amber">
                              {dept}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <Button
                variant="primary"
                style={{ flex: 1 }}
                icon={Zap}
                onClick={() => {
                  setSelectedSlot(null);
                  navigate("/ml-planning");
                }}
              >
                Go to ML Optimizer
              </Button>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                icon={MapPin}
                onClick={() => {
                  setSelectedSlot(null);
                  navigate("/map");
                }}
              >
                View on Railway Map
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
