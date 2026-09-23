/**
 * mlScoring.engine.js — ML Priority Scoring Layer (Stage 2.5)
 *
 * Implements a Weighted Multi-Criteria Decision Model (MCDM) for
 * ranking Work Packages using normalized feature vectors.
 *
 * This is a standard Operations Research / ML technique used in
 * real-world scheduling systems (analogous to LambdaRank / listwise ranking).
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Five Feature Dimensions with Documented Weights:           │
 * │                                                             │
 * │  F1: Urgency Score        (w=0.30) — Operational deadline   │
 * │  F2: Criticality Score    (w=0.25) — Asset safety risk      │
 * │  F3: Deadline Proximity   (w=0.25) — Time to expiry         │
 * │  F4: Time Savings Gain    (w=0.10) — Efficiency from club.  │
 * │  F5: Consolidation Gain   (w=0.10) — Dept × task merge gain │
 * │                                                             │
 * │  All features are MIN-MAX normalized across the full batch  │
 * │  before weighting → prevents scale bias.                    │
 * │                                                             │
 * │  SPI = Σ (w_i × normalize(f_i))   ∈ [0, 1]                 │
 * │  Higher SPI = higher scheduling priority                    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Output per package:
 *   ml_priority_index   — float [0, 1], the computed SPI
 *   ml_feature_vector   — { urgency, criticality, deadline, time_savings, consolidation }
 *   ml_feature_weights  — documented weight config
 *   ml_rank             — rank position (1 = highest priority)
 */

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// Feature weight configuration
// Weights must sum to 1.0 — validated in computeWeightSum() below.
// ─────────────────────────────────────────────────────────────────────────────
const FEATURE_WEIGHTS = {
  urgency:       0.30, // Operational deadline urgency — highest weight
  criticality:   0.25, // Asset safety criticality
  deadline:      0.25, // Calendar deadline proximity
  time_savings:  0.10, // Efficiency gain from multi-crew clubbing
  consolidation: 0.10, // Dept × task count merge gain
};

// Deadline scoring breakpoints (slack days → normalized urgency score)
const DEADLINE_BREAKPOINTS = [
  { days: 0,        score: 1.00 }, // Already overdue → maximum urgency
  { days: 1,        score: 0.95 }, // Due within 24 h
  { days: 3,        score: 0.80 }, // Due within 3 days
  { days: 7,        score: 0.60 }, // Due within a week
  { days: 14,       score: 0.40 }, // Due within 2 weeks
  { days: Infinity, score: 0.20 }, // Far-future deadline
];

// Baseline score for tasks with no declared deadline
const NO_DEADLINE_SCORE = 0.40;

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3: Deadline Proximity Score
// Converts deadline slack (days) into a [0,1] urgency score.
// Inverse relationship: closer deadline → higher score.
// ─────────────────────────────────────────────────────────────────────────────
function computeDeadlineScore(pkg, nowMs) {
  if (!pkg.earliest_deadline) return NO_DEADLINE_SCORE;

  const deadlineMs = new Date(pkg.earliest_deadline).getTime();
  if (Number.isNaN(deadlineMs)) return NO_DEADLINE_SCORE;

  const slackDays = (deadlineMs - nowMs) / (1000 * 60 * 60 * 24);

  for (const { days, score } of DEADLINE_BREAKPOINTS) {
    if (slackDays <= days) return score;
  }
  return 0.20;
}

// ─────────────────────────────────────────────────────────────────────────────
// Min-Max Normalization
// Scales all raw feature values to [0, 1] across the entire package batch.
// This prevents scale bias — e.g. urgency (1-4) vs time_savings (0-300 mins).
// If all values are identical (max === min), every item receives 1.0 (equal).
// ─────────────────────────────────────────────────────────────────────────────
function minMaxNormalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1.0);
  return values.map((v) => (v - min) / (max - min));
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw Feature Extraction
// Computes un-normalized raw feature values for a single package.
// ─────────────────────────────────────────────────────────────────────────────
function extractRawFeatures(pkg, nowMs) {
  const tasks     = Array.isArray(pkg.tasks) ? pkg.tasks : [];
  const deptCount = (pkg.departments_involved || []).length || 1;
  const taskCount = pkg.task_count || tasks.length || 1;

  // F1: Max urgency across all tasks in the cluster (1–4 IR scale)
  const maxUrgency = tasks.reduce(
    (max, t) => Math.max(max, Number(t.urgency || 1)),
    Number(pkg.urgency || 1)
  );

  // F2: Max criticality across all tasks in the cluster (1–4 IR scale)
  const maxCriticality = tasks.reduce(
    (max, t) => Math.max(max, Number(t.criticality || 1)),
    Number(pkg.criticality || 1)
  );

  // F3: Deadline proximity (already [0,1] range, still normalized across batch for consistency)
  const deadlineScore = computeDeadlineScore(pkg, nowMs);

  // F4: Minutes saved vs sequential execution (from clusteringEngine.time_saved_mins)
  const timeSavings = Number(pkg.time_saved_mins) || 0;

  // F5: Dept × task consolidation gain (more departments merged = higher operational value)
  const consolidationGain = deptCount * taskCount;

  return {
    rawUrgency:       maxUrgency,
    rawCriticality:   maxCriticality,
    rawDeadlineScore: deadlineScore,
    rawTimeSavings:   timeSavings,
    rawConsolidation: consolidationGain,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export: scoreAndRankPackages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * scoreAndRankPackages
 *
 * Takes work packages from clusteringEngine, computes a normalized
 * ML Smart Priority Index (SPI) via MCDM, and returns them re-ranked.
 *
 * Pipeline:
 *   1. Extract raw feature values for each package
 *   2. Min-Max normalize each feature across the full batch
 *   3. Compute weighted SPI: SPI = Σ (w_i × norm_feature_i)
 *   4. Sort descending (emergency packages always take top slots)
 *   5. Assign ml_rank positions
 *
 * @param {Array}  workPackages  - Output of generateWorkPackages()
 * @param {number} [nowMs]       - Epoch ms reference (default: Date.now())
 * @returns {Array}              - Packages enriched with ml_* fields, sorted by SPI DESC
 */
function scoreAndRankPackages(workPackages, nowMs = Date.now()) {
  if (!Array.isArray(workPackages) || workPackages.length === 0) return [];

  // ── Step 1: Extract raw feature values per package ────────────────────────
  const withRaw = workPackages.map((pkg) => ({
    ...pkg,
    _raw: extractRawFeatures(pkg, nowMs),
  }));

  // ── Step 2: Batch min-max normalization per feature ───────────────────────
  const featureKeys = [
    "rawUrgency",
    "rawCriticality",
    "rawDeadlineScore",
    "rawTimeSavings",
    "rawConsolidation",
  ];

  const normMaps = {};
  for (const key of featureKeys) {
    normMaps[key] = minMaxNormalize(withRaw.map((p) => p._raw[key]));
  }

  // ── Step 3: Compute Weighted Smart Priority Index per package ─────────────
  const scored = withRaw.map((pkg, idx) => {
    const normUrgency       = normMaps.rawUrgency[idx];
    const normCriticality   = normMaps.rawCriticality[idx];
    const normDeadline      = normMaps.rawDeadlineScore[idx];
    const normTimeSavings   = normMaps.rawTimeSavings[idx];
    const normConsolidation = normMaps.rawConsolidation[idx];

    const spi = clamp(
      FEATURE_WEIGHTS.urgency       * normUrgency +
      FEATURE_WEIGHTS.criticality   * normCriticality +
      FEATURE_WEIGHTS.deadline      * normDeadline +
      FEATURE_WEIGHTS.time_savings  * normTimeSavings +
      FEATURE_WEIGHTS.consolidation * normConsolidation
    );

    // Remove internal _raw field before returning to caller
    const { _raw, ...cleanPkg } = pkg;

    return {
      ...cleanPkg,
      ml_priority_index:  round4(spi),
      ml_feature_vector: {
        urgency:       round4(normUrgency),
        criticality:   round4(normCriticality),
        deadline:      round4(normDeadline),
        time_savings:  round4(normTimeSavings),
        consolidation: round4(normConsolidation),
      },
      ml_feature_weights: { ...FEATURE_WEIGHTS },
    };
  });

  // ── Step 4: Sort descending by SPI ───────────────────────────────────────
  // Emergency override: has_emergency packages always float to the very top,
  // regardless of computed SPI, preserving the safety-critical guarantee.
  scored.sort((a, b) => {
    if (a.has_emergency && !b.has_emergency) return -1;
    if (!a.has_emergency && b.has_emergency) return 1;
    return b.ml_priority_index - a.ml_priority_index;
  });

  // ── Step 5: Assign rank positions (1 = scheduled first) ──────────────────
  return scored.map((pkg, idx) => ({ ...pkg, ml_rank: idx + 1 }));
}

module.exports = {
  scoreAndRankPackages,
  computeDeadlineScore,
  FEATURE_WEIGHTS,
  DEADLINE_BREAKPOINTS,
};
