import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/**
 * First-party traffic counting for the super-admin panel.
 *
 * Called from src/proxy.js, which in Next 16 runs in the Node runtime, so this
 * can talk to MongoDB directly. That means there is no client script, no
 * analytics cookie and no third party: every counter here comes from a request
 * the server was already handling.
 *
 * What is stored
 * --------------
 * One aggregate row per day per "kind" (see prisma/schema.prisma), plus a short
 * -lived hash used solely to answer "have I already counted this person today?".
 *
 * What is NOT stored
 * ------------------
 * The IP address, the raw user agent, the full URL with its query string, and
 * the referrer URL are all inputs to a hash or are reduced to a coarse bucket
 * before they reach MongoDB. Nothing here can be walked backwards to a person,
 * and because the hash is salted with the day, the same visitor cannot be
 * recognised on a different day.
 *
 * Counting rules
 * --------------
 * - GET only, and only real navigations (`sec-fetch-mode: navigate`, or an
 *   `accept: text/html` request when the header is absent). This keeps API
 *   calls, prefetches and script traffic out of the numbers.
 * - Do Not Track is honoured: if the header asks not to be tracked, the request
 *   is not counted at all.
 * - Obvious crawlers are dropped, otherwise search bots dominate every chart.
 * - Nothing in here may ever break navigation, so every failure is swallowed.
 */

/** How long a visitor hash survives. 35 days is enough for month-on-month views. */
export const VISITOR_RETENTION_DAYS = 35;

/** Daily counters are tiny, so a year of history is cheap to keep. */
export const COUNTER_RETENTION_DAYS = 400;

/**
 * A hard ceiling on distinct "kind" values per day. Without it, a spammer
 * pointing thousands of junk URLs at the site would grow the collection
 * without limit.
 */
const MAX_KINDS_PER_DAY = 200;

/** Obvious crawlers and headless clients. Deliberately conservative. */
const BOT_PATTERN =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|lighthouse|headlesschrome|phantomjs|puppeteer|playwright|curl\/|wget\/|python-requests|go-http-client|java\/|okhttp|axios\/|node-fetch|postman|insomnia/i;

/** Referrers are reduced to these buckets, or to a bare hostname. */
const NAMED_REFERRERS = new Map([
  ["google.", "google"],
  ["bing.", "bing"],
  ["duckduckgo.", "duckduckgo"],
  ["yahoo.", "yahoo"],
  ["baidu.", "baidu"],
  ["yandex.", "yandex"],
  ["ecosia.", "ecosia"],
  ["brave.", "brave"],
  ["facebook.", "facebook"],
  ["instagram.", "instagram"],
  ["linkedin.", "linkedin"],
  ["youtube.", "youtube"],
  ["reddit.", "reddit"],
  ["news.ycombinator", "hacker news"],
  ["t.co", "x"],
  ["x.com", "x"],
  ["telegram.", "telegram"],
  ["wa.me", "whatsapp"],
  ["github.", "github"],
  ["stackoverflow.", "stackoverflow"],
]);

/** Set once per process to stop a failing analytics write flooding the logs. */
let hasWarned = false;
/** Throttles the housekeeping deleteMany to at most once per 15 minutes. */
let lastPrunedAt = 0;
const PRUNE_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Kinds this process has already bumped today, used to enforce the cap without
 * a query per request. Per-process, so a multi-instance deployment can sit a
 * little over the limit rather than growing without bound.
 */
const kindsSeenToday = new Set();
let kindsSeenDay = dayKey();

/** YYYY-MM-DD in UTC. Counters are bucketed by UTC day, not local time. */
export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysAgoKey(days, from = new Date()) {
  return dayKey(new Date(from.getTime() - days * 24 * 60 * 60 * 1000));
}

/**
 * A salt that is stable for a given day but different every day, derived from
 * AUTH_SECRET rather than stored anywhere. Stability within the day is what
 * makes the de-duplication work; rotating it is what stops cross-day tracking.
 */
function saltForDay(day) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "no-secret-configured"}|${day}`)
    .digest("hex");
}

/**
 * Reduces a path to a shape that cannot leak anything. Query strings and
 * fragments are dropped, and anything that looks like an identifier becomes
 * ":id", so /join/65f1c0… and /join/65f2a9… collapse to one bucket.
 */
function normalisePath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const shape = segments.map((segment) => {
    const decoded = safeDecode(segment);
    if (decoded.length > 24) return ":id";
    if (/^[0-9a-f]{24}$/i.test(decoded)) return ":id";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(decoded)) return ":id";
    if (/^\d+$/.test(decoded)) return ":id";
    return decoded;
  });
  return `/${shape.join("/")}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The address, used only as hash input. Never stored. */
function clientIp(headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Coarse device class from the user agent. This is a category, not a
 * fingerprint: it deliberately cannot tell two phones apart.
 */
function deviceClass(userAgent) {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|android|blackberry|iemobile|opera mini/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** A referrer becomes "direct", "internal", a known source, or a bare hostname. */
function referrerBucket(request, origin) {
  const raw = request.headers.get("referer") ?? request.headers.get("referrer");
  if (!raw) return "direct";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "direct";
  }
  if (origin && url.origin === origin) return "internal";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return "direct";
  for (const [needle, label] of NAMED_REFERRERS) {
    if (host.includes(needle)) return label;
  }
  // Keep the registrable-looking tail only, so a personal subdomain does not
  // become its own bucket.
  const parts = host.split(".");
  const tail = parts.length > 2 ? parts.slice(-2).join(".") : host;
  return tail.slice(0, 40);
}

/**
 * Decides whether a request should be counted, and if so what shape it is.
 * Returns null when the request must be ignored.
 */
export function describeRequest(request) {
  if (request.method !== "GET") return null;

  // Honour Do Not Track outright.
  if (request.headers.get("dnt") === "1") return null;

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgent || BOT_PATTERN.test(userAgent)) return null;

  // Real navigations only. `sec-fetch-mode` is the precise signal; the accept
  // header is the fallback for browsers that omit it.
  const fetchMode = request.headers.get("sec-fetch-mode");
  if (fetchMode) {
    if (fetchMode !== "navigate") return null;
  } else if (!(request.headers.get("accept") ?? "").includes("text/html")) {
    return null;
  }

  const url = new URL(request.url);
  const day = dayKey();
  const ip = clientIp(request.headers);
  const hash = createHash("sha256")
    .update(`${saltForDay(day)}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);

  return {
    day,
    hash,
    expiresAt: new Date(Date.now() + VISITOR_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    page: normalisePath(url.pathname),
    referrer: referrerBucket(request, url.origin),
    device: deviceClass(userAgent),
  };
}

function warnOnce(error) {
  if (hasWarned) return;
  hasWarned = true;
  console.error("[analytics] traffic counting disabled after an error:", error?.message ?? error);
}

/**
 * Records one visit. Always resolves — a database problem here must never turn
 * into a failed page load.
 */
export async function recordVisit(visit) {
  if (!visit) return;
  try {
    // The insert is the de-duplication test: it only succeeds the first time a
    // given visitor appears on a given day.
    let isNewVisitor = false;
    try {
      await db.visitVisitor.create({
        data: { day: visit.day, hash: visit.hash, expiresAt: visit.expiresAt },
      });
      isNewVisitor = true;
    } catch (error) {
      if (error?.code !== "P2002") throw error;
    }

    const bump = (kind, uniques = 0) => {
      // TOTAL is always counted; anything past the cap is dropped so a spam run
      // against junk URLs cannot grow the collection without limit.
      if (kind !== "TOTAL") {
        if (kindsSeenDay !== visit.day) {
          kindsSeenDay = visit.day;
          kindsSeenToday.clear();
        }
        if (kindsSeenToday.has(kind)) {
          return db.visitDaily.upsert({
            where: { day_kind: { day: visit.day, kind } },
            create: { day: visit.day, kind, count: 1 },
            update: { count: { increment: 1 } },
          });
        }
        if (kindsSeenToday.size >= MAX_KINDS_PER_DAY) return Promise.resolve();
        kindsSeenToday.add(kind);
      }
      return db.visitDaily.upsert({
        where: { day_kind: { day: visit.day, kind } },
        create: { day: visit.day, kind, count: 1, uniques },
        update: { count: { increment: 1 }, uniques: { increment: uniques } },
      });
    };

    await Promise.all([
      // Only the TOTAL row carries a unique count; summing per-page uniques
      // would count anyone who opened two screens twice.
      bump("TOTAL", isNewVisitor ? 1 : 0),
      bump(`page:${visit.page}`),
      bump(`ref:${visit.referrer}`),
      bump(`device:${visit.device}`),
    ]);

    void pruneIfDue();
  } catch (error) {
    warnOnce(error);
  }
}

/** Housekeeping: drop expired visitor hashes and very old counters. */
export async function pruneIfDue(now = Date.now()) {
  if (now - lastPrunedAt < PRUNE_INTERVAL_MS) return;
  lastPrunedAt = now;
  try {
    const nowDate = new Date(now);
    await db.visitVisitor.deleteMany({
      where: { expiresAt: { lt: nowDate } },
    });
    await db.visitDaily.deleteMany({
      where: { updatedAt: { lt: new Date(now - COUNTER_RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });
  } catch (error) {
    warnOnce(error);
  }
}

/**
 * Reads the counters back for the dashboard. Super-admin only is enforced by
 * the caller.
 */
export async function readTraffic(days = 30) {
  const from = daysAgoKey(days - 1);
  const rows = await db.visitDaily.findMany({
    where: { day: { gte: from } },
    select: { day: true, kind: true, count: true, uniques: true },
  });

  const byDay = new Map();
  const pages = new Map();
  const referrers = new Map();
  const devices = new Map();

  for (const row of rows) {
    if (row.kind === "TOTAL") {
      byDay.set(row.day, { views: row.count, uniques: row.uniques });
      continue;
    }
    const [dimension, ...rest] = row.kind.split(":");
    const value = rest.join(":");
    const target =
      dimension === "page" ? pages : dimension === "ref" ? referrers : dimension === "device" ? devices : null;
    if (!target) continue;
    target.set(value, (target.get(value) ?? 0) + row.count);
  }

  // Fill the gaps so the chart draws a real timeline rather than skipping days.
  const series = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = daysAgoKey(offset);
    const entry = byDay.get(day) ?? { views: 0, uniques: 0 };
    series.push({ day, ...entry });
  }

  const top = (map, limit) =>
    [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

  const totals = series.reduce(
    (acc, entry) => ({ views: acc.views + entry.views, uniques: acc.uniques + entry.uniques }),
    { views: 0, uniques: 0 },
  );

  const today = series.at(-1) ?? { day: dayKey(), views: 0, uniques: 0 };
  const sumWindow = (n) =>
    series.slice(-n).reduce(
      (acc, entry) => ({ views: acc.views + entry.views, uniques: acc.uniques + entry.uniques }),
      { views: 0, uniques: 0 },
    );

  return {
    days,
    series,
    totals,
    today,
    last7: sumWindow(7),
    previous7: sumWindow(14),
    pages: top(pages, 8),
    referrers: top(referrers, 6),
    devices: [...devices.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  };
}
