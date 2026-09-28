/**
 * Date + month-key helpers.
 *
 * Two rules make this predictable across timezones:
 *  1. A "day" in a mess is a calendar day. It is persisted as **UTC midnight**
 *     so that a meal logged in Dhaka is the same row no matter where the server
 *     runs. Always go through `parseDateInput` / `todayUtcMidnight`.
 *  2. A month is a `YYYY-MM` string, and it is derived from stored timestamps
 *     with the UTC getters. That keeps the key stable no matter the server TZ.
 */

export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_NAMES_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");

export function isMonthKey(value) {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

export function monthKeyFromDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** "Today" from the visitor's own clock, normalised to UTC midnight. */
export function todayUtcMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function currentMonthKey() {
  return monthKeyFromDate(todayUtcMidnight());
}

/** Accepts "YYYY-MM-DD" or a Date; returns UTC midnight, or null if invalid. */
export function parseDateInput(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  if (typeof value !== "string" || !value.trim()) return null;

  const raw = value.trim();
  if (DATE_INPUT_PATTERN.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    // Reject impossible dates like 2026-02-31 rolling over into March.
    return monthKeyFromDate(date) === `${y}-${pad(m)}` && date.getUTCDate() === d
      ? date
      : null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function toDateInputValue(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Number of days in a `YYYY-MM` month. */
function daysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Half-open UTC range covering a whole month — use for Prisma filters. */
export function monthDateRange(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

/** Every day of the month as UTC-midnight Dates. */
export function monthDates(monthKey) {
  const total = daysInMonth(monthKey);
  const [year, month] = monthKey.split("-").map(Number);
  return Array.from({ length: total }, (_, i) => new Date(Date.UTC(year, month - 1, i + 1)));
}

export function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKeyFromDate(shifted);
}

/** "2026-09" -> "September 2026" */
export function monthLabel(monthKey, { short = false } = {}) {
  const [year, month] = monthKey.split("-").map(Number);
  const name = short ? MONTH_NAMES_SHORT[month - 1] : MONTH_NAMES[month - 1];
  return `${name} ${year}`;
}

/** "2026-09" -> "Sep 26" (for compact month switchers) */
export function monthLabelWithYear(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES_SHORT[month - 1]} ${String(year).slice(2)}`;
}

export function formatDate(date) {
  const d = new Date(date);
  return `${d.getUTCDate()} ${MONTH_NAMES_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateLong(date) {
  const d = new Date(date);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function weekdayShort(date) {
  return WEEKDAYS[new Date(date).getUTCDay()];
}

/** True when a stored UTC-midnight date is the visitor's today. */
export function isToday(date) {
  return toDateInputValue(date) === toDateInputValue(todayUtcMidnight());
}

/** "3 days ago", "just now", ... */
export function relativeTime(date) {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
