const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

// Bring every train-block movement onto a single simulated operating day so that
// priority-vs-priority collision comparisons are meaningful across the whole fleet.
// Windows are expressed in minutes-of-day (UTC) anchored to 2026-09-18T00:00:00Z;
// overnight exits are capped at midnight (the overnight tail is not simulated).
const BASE18 = Date.UTC(2026, 8, 18);
const DAY_MIN = 1440;

(async () => {
  const rows = await p.trainBlockMovement.findMany();
  let updated = 0;
  let skipped = 0;
  for (const r of rows) {
    const s = new Date(r.scheduled_entry).getTime();
    const x = new Date(r.scheduled_exit).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(x)) { skipped += 1; continue; }
    const sMin = new Date(s).getUTCHours() * 60 + new Date(s).getUTCMinutes();
    const elapsed = Math.max(0, Math.min(DAY_MIN, (x - s) / 60000));
    const startAbs = BASE18 + sMin * 60000;
    const endAbs = startAbs + Math.min(elapsed, DAY_MIN - sMin) * 60000;
    if (endAbs <= startAbs) { skipped += 1; continue; }
    await p.trainBlockMovement.update({
      where: { movement_id: r.movement_id },
      data: { scheduled_entry: new Date(startAbs), scheduled_exit: new Date(endAbs) },
    });
    updated += 1;
  }
  console.log(`Normalized ${updated} movements onto ${new Date(BASE18).toISOString()}; skipped ${skipped}.`);
})()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());