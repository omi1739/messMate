/**
 * Audits every route in both themes for text that cannot be read.
 *
 * check-contrast.mjs proves the *tokens* are well chosen, which is necessary
 * but not sufficient: a theme looks wrong when a component stops using the
 * tokens, or when two surfaces that should differ end up identical, and neither
 * shows up in a token table. So this renders each page for real and measures
 * what a reader would actually get.
 *
 * For every element with visible text it composites the colour through any
 * translucent ancestors down to the first opaque one, then applies the WCAG
 * contrast formula. It also reports text that has become invisible, surfaces
 * that collapsed onto the page background, and any computed colour that is not
 * one of the theme tokens.
 *
 * Drives the locally installed Chrome over the DevTools Protocol, so there is
 * still no Playwright/Puppeteer dependency.
 *
 *   npm run check:dark          (needs the dev server on :3000)
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const PORT = 9334;

/**
 * The super-admin credentials live in .env, which npm does not load. Reading
 * them here means `npm run check:dark` audits /admin like every other script
 * instead of quietly skipping the one route a visitor never sees.
 */
function readEnvFile() {
  const out = {};
  let raw;
  try {
    raw = readFileSync(".env", "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const OWNER = { email: "e2e-probe@test.local", password: "Probe12345" };

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/admin-login", "/no-such-page"];
const OWNER_ROUTES = ["/dashboard", "/members", "/meals", "/expenses", "/bills", "/reports", "/settings"];
const ADMIN_ROUTES = ["/admin"];

function findBrowser() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  throw new Error("No Chrome/Chromium found. Set CHROME_PATH.");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- minimal CDP client -----------------------------------------------------

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 45000);
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  once(method, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeout);
      this.on(method, (p) => {
        clearTimeout(timer);
        resolve(p);
      });
    });
  }
}

async function evaluate(cdp, session, expression) {
  const { result, exceptionDetails } = await cdp.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    session,
  );
  if (exceptionDetails) {
    throw new Error(exceptionDetails.text + " " + (exceptionDetails.exception?.description ?? ""));
  }
  return result.value;
}

async function waitForSelector(cdp, session, selector, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = await evaluate(
      cdp,
      session,
      `!!document.querySelector(${JSON.stringify(selector)})`,
    );
    if (found) return true;
    await sleep(200);
  }
  return false;
}

const FILL = `(sel, value) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error('no input for ' + sel);
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}`;

async function signIn(cdp, session, { path, email, password }) {
  await cdp.send("Page.navigate", { url: `${BASE}${path}` }, session);
  await waitForSelector(cdp, session, 'input[type="password"]');
  await evaluate(cdp, session, `(${FILL})('input[type="email"]', ${JSON.stringify(email)})`);
  await evaluate(cdp, session, `(${FILL})('input[type="password"]', ${JSON.stringify(password)})`);
  await evaluate(cdp, session, `document.querySelector('form').requestSubmit(), true`);
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const url = await evaluate(cdp, session, "location.pathname");
    if (!url.includes("login")) return url;
    await sleep(250);
  }
  throw new Error(`sign-in did not leave ${path}`);
}

/**
 * Runs in the page. Returns every contrast problem it can see, plus a summary
 * of the surfaces actually in use so a token that stopped being applied shows
 * up as an unexpected colour.
 */
const AUDIT = `(() => {
  const parse = (value) => {
    if (!value || value === 'transparent') return null;
    const m = value.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };
  const css = (c) => 'rgb(' + [c.r, c.g, c.b].map((n) => Math.round(n)).join(',') + ')';

  // Walk ancestors until something opaque, compositing translucent layers.
  const effectiveBg = (el) => {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
      node = node.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };

  const visible = (el, cs) => {
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    // An ancestor at zero opacity hides the text just as effectively.
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      if (Number(getComputedStyle(p).opacity) === 0) return false;
    }
    return true;
  };

  const problems = [];
  const surfaces = new Map();
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  let checked = 0;

  for (const el of document.body.querySelectorAll('*')) {
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') continue;
    const cs = getComputedStyle(el);

    // Record the distinct surface colours in use.
    const own = parse(cs.backgroundColor);
    if (own && own.a >= 1) {
      const key = css(own);
      surfaces.set(key, (surfaces.get(key) ?? 0) + 1);
    }

    // Only elements that directly own a text node.
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) continue;
    if (!visible(el, cs)) continue;

    checked++;
    const fgRaw = parse(cs.color);
    if (!fgRaw) continue;
    const bg = effectiveBg(el);
    const fg = fgRaw.a >= 1 ? fgRaw : over(fgRaw, bg);
    const cr = ratio(fg, bg);

    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const min = large ? 3 : 4.5;

    if (cr < min) {
      problems.push({
        kind: cr < 1.05 ? 'invisible' : 'low-contrast',
        text: text.length > 58 ? text.slice(0, 58) + '…' : text,
        ratio: Math.round(cr * 100) / 100,
        need: min,
        fg: css(fg),
        bg: css(bg),
        size,
        tag: tag.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 70),
      });
    }
  }

  // A card that is the same colour as the page behind it has no edge.
  const flatSurfaces = [...surfaces.entries()]
    .filter(([key]) => key === css(bodyBg))
    .map(([key, n]) => key + ' x' + n);

  // A border colour with no width anywhere is a border that was never drawn.
  // Tailwind's preflight leaves border-width at 0, so 'border-border' on its
  // own silently does nothing, which is easy to miss and looks like a mistake.
  const colourWithoutWidth = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const w = ['Top', 'Right', 'Bottom', 'Left']
      .map((s) => parseFloat(cs['border' + s + 'Width']) || 0)
      .reduce((a, b) => a + b, 0);
    if (w > 0) continue;
    if (parseFloat(cs.outlineWidth) > 0) continue;
    const cls = String(el.className?.baseVal ?? el.className ?? '');
    const wantsBorder = ['border-border', 'border-border-strong', 'border-primary-border']
      .some((t) => cls.includes(t));
    if (!wantsBorder) continue;
    // A row that is explicitly border-0 is meant to have no line.
    if (/(^|[: ])border-0(\s|$)/.test(cls)) continue;
    if (!visible(el, cs)) continue;
    colourWithoutWidth.push(el.tagName.toLowerCase() + '.' + cls.slice(0, 60));
  }

  // Read the elevation ladder straight off the cascade so the ordering that
  // makes a card look like a card is asserted, not assumed.
  const probe = getComputedStyle(document.documentElement);
  const ladder = {};
  for (const name of ['--background', '--surface-muted', '--surface', '--surface-raised']) {
    ladder[name] = probe.getPropertyValue(name).trim();
  }

  return {
    problems,
    checked,
    flatSurfaces,
    colourWithoutWidth,
    ladder,
    bodyBg: css(bodyBg),
    surfaces: [...surfaces.entries()],
  };
})()`;

/*
 * The app defaults to the light theme, so emulating prefers-color-scheme is no
 * longer enough to ask for dark: the OS preference only decides the "system"
 * option. This writes the stored preference before any page script runs, which
 * is also the only way to exercise the pre-paint theme script in layout.js.
 */
let injectedThemeScript = null;

async function selectTheme(cdp, session, theme) {
  if (injectedThemeScript) {
    await cdp.send(
      "Page.removeScriptToEvaluateOnNewDocument",
      { identifier: injectedThemeScript },
      session,
    );
  }
  const { identifier } = await cdp.send(
    "Page.addScriptToEvaluateOnNewDocument",
    { source: `try{localStorage.setItem("messmate-theme", ${JSON.stringify(theme)})}catch(e){}` },
    session,
  );
  injectedThemeScript = identifier;

  // Keep the media query in step so `color-scheme` and the system option agree
  // with what we are actually rendering.
  await cdp.send(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-color-scheme", value: theme }] },
    session,
  );
}

async function auditRoute(cdp, session, route, theme) {
  await selectTheme(cdp, session, theme);
  const loaded = cdp.once("Page.loadEventFired", 30000).catch(() => null);
  await cdp.send("Page.navigate", { url: `${BASE}${route}` }, session);
  await loaded;
  await waitForSelector(cdp, session, "main, body", 15000);
  await sleep(700); // fonts, charts and hydration

  // The stored preference is the only proof that the theme was applied, so read
  // it back rather than trusting the luminance numbers alone.
  const applied = await evaluate(cdp, session, `document.documentElement.classList.contains("dark") ? "dark" : "light"`);
  const expected = theme === "dark" ? "dark" : "light";

  const r = await evaluate(cdp, session, AUDIT);
  r.themeApplied = applied;
  r.themeExpected = expected;
  return r;
}

/**
 * Mean relative luminance of a PNG, 0 (black) to 1 (white). Used to prove the
 * dark theme is actually dark on every route: a page whose "dark" capture is
 * as bright as its light one means the theme never applied, which no contrast
 * check would notice.
 */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let width, height, colorType;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : null;
  if (!channels) throw new Error("unsupported colour type");
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error("bad filter");
      }
      cur[x] = v & 0xff;
    }
  }
  let sum = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = y * width * channels + x * channels;
      sum += (0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2]) / 255;
      n++;
    }
  }
  return n ? sum / n : 0;
}

async function captureLum(cdp, session) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" }, session);
  return decodePng(Buffer.from(data, "base64"));
}

/**
 * Lightness of a colour token, normalised to 0-1. The build pipeline rewrites
 * oklch() to lab() for browser support, and a custom property's computed value
 * is the substituted one, so both forms have to be understood here.
 */
function tokenL(token) {
  const lab = /lab\(\s*([0-9.]+)%/.exec(token ?? "");
  if (lab) return Number(lab[1]) / 100;
  const ok = /oklch\(\s*([0-9.]+)/.exec(token ?? "");
  if (ok) return Number(ok[1]);
  return null;
}

const LADDER = ["--background", "--surface-muted", "--surface", "--surface-raised"];

function describe(p) {
  return `${p.ratio}:1 (needs ${p.need})  "${p.text}"  ${p.fg} on ${p.bg}  ${p.size}px <${p.tag}> ${p.cls}`;
}

async function main() {
  try {
    await fetch(`${BASE}/login`, { redirect: "manual" });
  } catch {
    throw new Error(`No dev server at ${BASE}. Run "npm run dev" first.`);
  }

  const profile = join(tmpdir(), `messmate-dark-${Date.now()}`);
  const browser = spawn(
    findBrowser(),
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--force-color-profile=srgb",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let failures = 0;
  let totalText = 0;
  const allProblems = [];
  const notes = [];
  const lums = new Map();

  const SHOTS = join(tmpdir(), `messmate-dark-shots-${Date.now()}`);
  mkdirSync(SHOTS, { recursive: true });

  try {
    let wsUrl = null;
    for (let i = 0; i < 60 && !wsUrl; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        wsUrl = (await res.json()).webSocketDebuggerUrl;
      } catch {
        /* not up yet */
      }
    }
    if (!wsUrl) throw new Error("Chrome did not expose a debugging port");

    const cdp = await Cdp.connect(wsUrl);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const session = sessionId;

    await cdp.send("Page.enable", {}, session);
    await cdp.send("Runtime.enable", {}, session);
    await cdp.send("Emulation.setDeviceMetricsOverride",
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, session);

    async function sweep(label, routes) {
      console.log(`\n${label}`);
      for (const route of routes) {
        for (const theme of ["light", "dark"]) {
          const r = await auditRoute(cdp, session, route, theme);
          totalText += r.checked;

          if (r.themeApplied !== r.themeExpected) {
            failures++;
            notes.push(`[${theme}] ${route}  the theme did not apply: html class says "${r.themeApplied}"`);
          }

          const lum = await captureLum(cdp, session);
          lums.set(`${route}|${theme}`, lum);
          const { data } = await cdp.send("Page.captureScreenshot", { format: "png" }, session);
          const file = join(SHOTS, `${route.replace(/[^\w]+/g, "_") || "root"}-${theme}.png`);
          writeFileSync(file, Buffer.from(data, "base64"));

          // The three relationships that decide whether a card looks like a
          // card. A single "monotonic ladder" assertion is wrong: in the light
          // theme --surface and --surface-raised are both pure white on
          // purpose, because elevation there is carried by the shadow and white
          // cannot get lighter. What must hold in *both* themes is that each
          // name keeps its meaning.
          const [bg, muted, surface, raised] = LADDER.map((n) => tokenL(r.ladder[n]));
          const broken = [];
          if (muted >= surface) broken.push(`surface-muted (${muted}) is not recessed below surface (${surface})`);
          if (raised < surface) broken.push(`surface-raised (${raised}) is darker than surface (${surface})`);
          if (!(surface > bg)) broken.push(`surface (${surface}) does not stand out from the page (${bg})`);
          if (broken.length) {
            failures++;
            notes.push(`[${theme}] ${route}  ${broken.join("; ")}`);
          }

          const bad = r.problems;
          if (bad.length) {
            failures += bad.length;
            console.log(`  ${theme.padEnd(5)} ${route.padEnd(18)} ${String(r.checked).padStart(4)} text, ${bad.length} contrast problem(s), lum ${lum.toFixed(3)}`);
            for (const p of bad.slice(0, 6)) {
              console.log(`         - ${describe(p)}`);
              allProblems.push({ route, theme, ...p });
            }
            if (bad.length > 6) console.log(`         … and ${bad.length - 6} more`);
          } else {
            const ladderTxt = [bg, muted, surface, raised]
              .map((v) => (v === null ? "?" : v.toFixed(3)))
              .join("/");
            console.log(`  ${theme.padEnd(5)} ${route.padEnd(18)} ${String(r.checked).padStart(4)} text, ok, lum ${lum.toFixed(3)}, ladder ${ladderTxt}`);
          }

          if (r.flatSurfaces.length) {
            notes.push(`[${theme}] ${route}  surface identical to the page: ${r.flatSurfaces.join(", ")}`);
          }
          if (r.colourWithoutWidth.length) {
            const uniq = [...new Set(r.colourWithoutWidth)];
            notes.push(`[${theme}] ${route}  border colour with no width: ${uniq.slice(0, 3).join(" | ")}`);
            failures += uniq.length;
          }
        }

        // A "dark" page that is not darker than its light twin means the theme
        // never applied, whatever the contrast numbers say.
        const l = lums.get(`${route}|light`);
        const d = lums.get(`${route}|dark`);
        if (l !== undefined && d !== undefined && d >= l - 0.02) {
          failures++;
          notes.push(`[both] ${route}  dark capture is not darker than light (${d.toFixed(3)} vs ${l.toFixed(3)}) — the theme is not being applied`);
        }
      }
    }

    await sweep("public", PUBLIC_ROUTES);

    console.log("\nsigning in as the owner fixture");
    await signIn(cdp, session, { path: "/login", ...OWNER });
    await sweep("owner", OWNER_ROUTES);

    const env = readEnvFile();
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || env.SUPER_ADMIN_EMAIL;
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || env.SUPER_ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      await cdp.send("Network.clearBrowserCookies", {}, session);
      await cdp.send("Storage.clearDataForOrigin", { origin: BASE, storageTypes: "all" }, session);
      console.log("\nsigning in as the super admin");
      await signIn(cdp, session, { path: "/admin-login", email: adminEmail, password: adminPassword });
      await sweep("admin", ADMIN_ROUTES);
    } else {
      console.log("\nFAIL: skipping /admin because SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD are not in .env");
      failures++;
    }
  } finally {
    browser.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log(`\n${"-".repeat(64)}`);
  console.log(`${totalText} text elements checked across both themes`);
  console.log(`captures in ${SHOTS}`);

  if (notes.length) {
    console.log(`\n${notes.length} structural note(s):`);
    for (const n of notes) console.log(`  ${n}`);
  }

  if (failures === 0) {
    console.log("\nno contrast failures; surface-muted reads as recessed and surface-raised as raised in both themes; every dark capture is darker than its light twin");
  } else {
    console.log(`\n${failures} failure(s):`);
    for (const p of allProblems) console.log(`  [${p.theme}] ${p.route}  ${describe(p)}`);
  }
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
