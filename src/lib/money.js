/**
 * Money helpers.
 *
 * All amounts are stored as IEEE-754 doubles (`Float` in the Prisma schema),
 * which means every sum can accumulate representation error. The rule in this
 * codebase is: round at the boundary, never in the middle of a calculation.
 * Use `round2` when a value crosses into or out of the database or the UI.
 */

const CURRENCY_SYMBOLS = {
  BDT: "৳",
  INR: "₹",
  PKR: "₨",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SAR: "﷼",
  MYR: "RM",
};

/** Round to 2 decimal places, treating anything non-numeric as 0. */
export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // The EPSILON nudge stops values like 1.005 from rounding down due to
  // binary representation (1.00499999999999989...).
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Rounded sum of a list, optionally reading the number off each item. */
export function sumBy(list, pick = (x) => x) {
  if (!Array.isArray(list)) return 0;
  return round2(list.reduce((total, item) => total + (Number(pick(item)) || 0), 0));
}

export function currencySymbol(code) {
  if (!code) return CURRENCY_SYMBOLS.BDT;
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function formatNumber(value, fractionDigits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** 1234.5 -> "৳1,234.50", -99 -> "-৳99.00" */
export function formatMoney(amount, { currency = "BDT", withSymbol = true } = {}) {
  const value = round2(amount);
  const body = formatNumber(Math.abs(value), 2);
  const sign = value < 0 ? "-" : "";
  return withSymbol ? `${sign}${currencySymbol(currency)}${body}` : `${sign}${body}`;
}

/** Compact form for stat tiles: 125000 -> "৳1.25L" (South-Asian lakh/crore). */
export function formatMoneyCompact(amount, { currency = "BDT" } = {}) {
  const value = round2(amount);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currencySymbol(currency);

  if (abs >= 1_00_00_000) return `${sign}${symbol}${trim(abs / 1_00_00_000)}Cr`;
  if (abs >= 1_00_000) return `${sign}${symbol}${trim(abs / 1_00_000)}L`;
  if (abs >= 1_000) return `${sign}${symbol}${trim(abs / 1_000)}K`;
  return `${sign}${symbol}${formatNumber(abs, abs % 1 === 0 ? 0 : 2)}`;
}

function trim(n) {
  return n.toFixed(2).replace(/\.?0+$/, "");
}
