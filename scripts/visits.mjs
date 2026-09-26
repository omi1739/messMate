/**
 * Traffic counter maintenance.
 *
 *   node scripts/visits.mjs seed [days]   generate sample traffic to look at
 *   node scripts/visits.mjs reset          delete every counter
 *   node scripts/visits.mjs prune         delete expired visitor hashes
 *
 * `seed` REPLACES the counters, so do not run it against traffic you care about.
 * It exists so the admin panel can be reviewed before the site has any visitors.
 */
import { db } from "@/lib/db";
import { COUNTER_RETENTION_DAYS, VISITOR_RETENTION_DAYS } from "@/lib/analytics";

const command = process.argv[2] ?? "prune";
const days = Number(process.argv[3] ?? 30);

/** Deterministic PRNG, so a given seed always produces the same demo numbers. */
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAGES = [
  ["/", 34],
  ["/signup", 14],
  ["/login", 11],
  ["/dashboard", 9],
  ["/reports", 8],
  ["/members", 6],
  ["/expenses", 4],
  ["/meals", 3],
  ["/settings", 2],
  ["/join/:id", 3],
  ["/admin", 1],
];
const REFERRERS = [
  ["direct", 40],
  ["google", 26],
  ["internal", 14],
  ["hacker news", 7],
  ["x", 5],
  ["facebook", 4],
  ["reddit", 2],
  ["whatsapp", 2],
];
const DEVICES = [
  ["mobile", 62],
  ["desktop", 33],
  ["tablet", 5],
];

async function seed() {
  const random = mulberry32(20260927);
  const today = new Date();

  await db.visitDaily.deleteMany({});
  await db.visitVisitor.deleteMany({});
  console.log("cleared existing counters");

  const rows = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    const day = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;

    // A gentle upward trend towards today, quieter at weekends, with day-to-day
    // noise, so the chart looks like a real site rather than a flat line.
    const trend = 1 + ((days - offset) / days) * 0.8;
    const seasonal = isWeekend ? 0.55 : 1;
    const views = Math.max(1, Math.round((26 + random() * 22) * trend * seasonal));
    const uniques = Math.max(1, Math.round(views * (0.62 + random() * 0.2)));

    const add = (kind, count, uniqueCount = 0) => {
      if (count > 0) rows.push({ day, kind, count, uniques: uniqueCount });
    };

    add("TOTAL", views, uniques);
    for (const [page, weight] of PAGES) {
      const count = Math.round((views * weight) / 100);
      if (count > 0) add(`page:${page}`, count);
    }
    for (const [referrer, weight] of REFERRERS) {
      const count = Math.round((views * weight) / 100);
      if (count > 0) add(`ref:${referrer}`, count);
    }
    for (const [device, weight] of DEVICES) {
      const count = Math.round((views * weight) / 100);
      if (count > 0) add(`device:${device}`, count);
    }
  }

  // One upsert per row keeps the load predictable and leaves the collection
  // holding daily aggregates rather than one document per visit.
  let written = 0;
  for (const row of rows) {
    await db.visitDaily.upsert({
      where: { day_kind: { day: row.day, kind: row.kind } },
      create: row,
      update: { count: row.count, uniques: row.uniques },
    });
    written++;
  }

  const totals = rows.filter((row) => row.kind === "TOTAL");
  const views = totals.reduce((sum, row) => sum + row.count, 0);
  const visitors = totals.reduce((sum, row) => sum + row.uniques, 0);
  console.log(
    `wrote ${written} counter rows for ${totals.length} days ` +
      `(${views} views, ${visitors} visitor-days)`,
  );
  console.log("visitor hashes are not seeded; unique counts stand on their own");
}

async function reset() {
  const counters = await db.visitDaily.deleteMany({});
  const visitors = await db.visitVisitor.deleteMany({});
  console.log(`removed ${counters.count} counter rows and ${visitors.count} visitor hashes`);
}

async function prune() {
  const now = new Date();
  const visitors = await db.visitVisitor.deleteMany({ where: { expiresAt: { lt: now } } });
  const cutoff = new Date(now.getTime() - COUNTER_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const counters = await db.visitDaily.deleteMany({ where: { updatedAt: { lt: cutoff } } });
  console.log(
    `pruned ${visitors.count} expired hashes (kept ${VISITOR_RETENTION_DAYS} days) ` +
      `and ${counters.count} counters (kept ${COUNTER_RETENTION_DAYS} days)`,
  );
}

if (command === "seed") await seed();
else if (command === "reset") await reset();
else if (command === "prune") await prune();
else {
  console.error(`unknown command "${command}" — use seed, reset or prune`);
  process.exitCode = 1;
}

await db.$disconnect();
