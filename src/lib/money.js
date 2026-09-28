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

  // Symmetric, with ties going away from zero. `Math.round` is not symmetric: it
  // rounds -100.5 to -100, so the old expression turned +1.005 into 1.01 and
  // -1.005 into -1.00. The same magnitude then formatted two different ways
  // depending on which side of the sign it sat, and a refund could disagree
  // with the charge it was refunding. The sign is taken off first and put back
  // afterwards. The EPSILON nudge still rescues 1.005, which is stored as
  // 1.00499999999999989...
  const sign = n < 0 ? -1 : 1;
  const cents = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;

  // `|| 0` also folds -0 to 0, so a tiny negative amount cannot leak "-0" into
  // `Object.is`, a string, or a sign comparison further downstream.
  return sign * cents || 0;
}

/** Rounded sum of a list, optionally reading the number off each item. */
export function sumBy(list, pick = (x) => x) {
  if (!Array.isArray(list)) return 0;
  return round2(list.reduce((total, item) => total + (Number(pick(item)) || 0), 0));
}

// Not exported: every caller goes through `formatMoney` / `formatMoneyCompact`,
// which is the only place a symbol belongs next to a formatted amount.
function currencySymbol(code) {
  if (!code) return CURRENCY_SYMBOLS.BDT;
  // Own-property check, not just a lookup. The symbol table is a plain object
  // literal, so `currencySymbol("constructor")` used to return Object's
  // constructor and `currencySymbol("toString")` a function, either of which
  // then got interpolated straight into a rendered amount. `code` comes from a
  // per-mess settings field, so an unexpected value here is a formatting bug
  // rather than a security boundary — an unknown code still echoes itself.
  return Object.hasOwn(CURRENCY_SYMBOLS, code) ? CURRENCY_SYMBOLS[code] : code;
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
