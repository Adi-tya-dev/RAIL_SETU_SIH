const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

function diffMinutes(later, earlier) {
  return (later.getTime() - earlier.getTime()) / MINUTE_MS;
}

function overlapMinutes(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return end > start ? (end - start) / MINUTE_MS : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function timeOfDayMs(date) {
  return (
    ((date.getUTCHours() * 60 + date.getUTCMinutes()) * 60 + date.getUTCSeconds()) * 1000 +
    date.getUTCMilliseconds()
  );
}

function projectTimeOfDay(date, dayAnchor) {
  return new Date(startOfUtcDay(dayAnchor).getTime() + timeOfDayMs(date));
}

function projectIntoWindow(date, windowStart, windowEnd) {
  if (!date) return new Date(windowStart.getTime());
  if (date >= windowStart && date < windowEnd) return new Date(date.getTime());

  let candidate = projectTimeOfDay(date, windowStart);
  while (candidate < windowStart) candidate = new Date(candidate.getTime() + DAY_MS);
  if (candidate >= windowEnd) candidate = new Date(windowStart.getTime());
  return candidate;
}

function projectIntoWindowAfter(date, windowStart, windowEnd, after) {
  const candidate = projectIntoWindow(date, windowStart, windowEnd);
  while (candidate < after) candidate.setTime(candidate.getTime() + DAY_MS);
  return candidate;
}

module.exports = {
  MINUTE_MS,
  DAY_MS,
  addMinutes,
  diffMinutes,
  overlapMinutes,
  round,
  clamp,
  startOfUtcDay,
  timeOfDayMs,
  projectTimeOfDay,
  projectIntoWindow,
  projectIntoWindowAfter,
};
