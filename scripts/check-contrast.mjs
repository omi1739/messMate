/**
 * WCAG contrast audit of the theme tokens in src/app/globals.css.
 *
 * Only pairings the UI actually renders are checked. Accents are always used as
 * `text-<accent>` on `bg-<accent>-subtle` (see components/ui/badge.js), never as
 * `text-<accent>-foreground` on a subtle tint, so the `-foreground` tokens are
 * only meaningful on their own solid backgrounds.
 *
 * Exits non-zero if any pairing regresses, so it can gate a build.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync("src/app/globals.css", "utf8");

function block(selector) {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error(`no ${selector} block in globals.css`);
  const start = css.indexOf("{", i);
  let depth = 0;
  let end = start;
  for (let j = start; j < css.length; j++) {
    if (css[j] === "{") depth++;
    else if (css[j] === "}") {
      depth--;
      if (depth === 0) { end = j; break; }
    }
  }
  const vars = {};
  for (const m of css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

function oklchToRgb(str) {
  const m = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return null;
  const L = +m[1];
  const C = +m[2];
  const H = (+m[3] * Math.PI) / 180;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  return lin.map((v) => {
    const c = Math.max(0, Math.min(1, v));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  });
}

const luminance = (rgb) => {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const ACCENTS = ["primary", "success", "warning", "danger", "info"];

// [foreground, background, minimum, description]
const PAIRS = [
  ["foreground", "background", 4.5, "body text on the page"],
  ["foreground", "surface", 4.5, "body text on a card"],
  ["foreground", "surface-muted", 4.5, "body text on a muted band"],
  ["muted-foreground", "background", 4.5, "secondary text on the page"],
  ["muted-foreground", "surface", 4.5, "secondary text on a card"],
  ["muted-foreground", "surface-muted", 4.5, "secondary text on a muted band"],
  ["muted-foreground", "faint", 4.5, "secondary text on a faint tab"],
  ["primary-foreground", "primary", 4.5, "label on a primary button"],
  ["border-strong", "surface", 3.0, "outline button and table rule"],
  ["border-strong", "background", 3.0, "outline button on the page"],
];
for (const a of ACCENTS) {
  PAIRS.push([a, `${a}-subtle`, 4.5, `${a} text on its own tint`]);
  PAIRS.push([a, "surface", 4.5, `${a} text on a card`]);
}

let failures = 0;
for (const [theme, selector] of [["light", ":root {"], ["dark", ".dark {"]]) {
  const t = block(selector);
  console.log(`\n${theme.toUpperCase()}`);
  for (const [fg, bg, need, what] of PAIRS) {
    if (!t[fg] || !t[bg]) {
      console.log(`  ??  missing token for: ${what}`);
      failures++;
      continue;
    }
    const r = ratio(oklchToRgb(t[fg]), oklchToRgb(t[bg]));
    const ok = r >= need;
    if (!ok) failures++;
    console.log(
      `  ${ok ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(5)} (min ${need})  ${what}`,
    );
  }
}

// Dead tokens are a trap: they duplicate a live token and invite misuse.
console.log("\nDEAD TOKEN CHECK");
const js = [];
const cssFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.jsx?$/.test(entry.name)) js.push(readFileSync(full, "utf8"));
    else if (entry.name.endsWith(".css")) cssFiles.push(readFileSync(full, "utf8"));
  }
})("src");

const markup = js.join("\n");
const allCss = cssFiles.join("\n");
for (const token of ["muted", "surface-raised", "faint"]) {
  const re = new RegExp(`(?:text|bg|border|ring|from|to|via|fill|stroke|shadow|outline)-${token}(?![\\w-])`);
  const inMarkup = re.test(markup);
  const defined = new RegExp(`--${token}:`).test(allCss);
  if (defined && !inMarkup) {
    console.log(`  FAIL  --${token} is defined in CSS but never used in any component`);
    failures++;
  } else if (!defined) {
    console.log(`  pass  --${token} is not defined (and not used) - consistent`);
  } else {
    console.log(`  pass  --${token} is defined and in use`);
  }
}

if (failures) {
  console.log(`\n${failures} contrast/dead-token failure(s).`);
  process.exit(1);
}
console.log("\nall pairings meet WCAG AA, no dead tokens.");
