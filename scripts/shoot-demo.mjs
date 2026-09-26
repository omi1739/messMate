/**
 * Capture demo screenshots of the signed-in app.
 *
 * Drives the locally installed Chrome over the DevTools Protocol using Node's
 * built-in WebSocket, so it needs no Playwright/Puppeteer dependency. Chrome is
 * found via PATH or the usual Windows install locations.
 *
 * Requires the dev server on :3000 and the `db:seed:e2e` fixtures to exist.
 * Credentials come from .env (superadmin) and from the seed script (owner) and
 * are never printed.
 *
 *   node --import ./scripts/register.mjs scripts/shoot-demo.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const OUT = "public/demo";
const PORT = 9333;
const VIEWPORT = { width: 1440, height: 900, scale: 1 };
const MAX_HEIGHT = 6000;

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
        if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? "")})`));
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

// --- page helpers -----------------------------------------------------------

async function evaluate(cdp, session, expression) {
  const { result, exceptionDetails } = await cdp.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    session,
  );
  if (exceptionDetails) throw new Error(exceptionDetails.text + " " + (exceptionDetails.exception?.description ?? ""));
  return result.value;
}

async function waitForSelector(cdp, session, selector, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = await evaluate(
      cdp,
      session,
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el; })()`,
    );
    if (found) return true;
    await sleep(200);
  }
  return false;
}

/** Fill a React-controlled input the way a user would, so hooks register it. */
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
  throw new Error(`sign-in did not leave ${path} (still on ${path})`);
}

async function shoot(cdp, session, { slug, route, width = VIEWPORT.width, height = VIEWPORT.height, ready = "main" }) {
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: VIEWPORT.scale, mobile: width < 700 },
    session,
  );
  // The app defaults to the system colour scheme, so pin it explicitly.
  await cdp.send(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-color-scheme", value: "light" }] },
    session,
  );

  const loaded = cdp.once("Page.loadEventFired", 30000).catch(() => null);
  await cdp.send("Page.navigate", { url: `${BASE}${route}` }, session);
  await loaded;
  // Waiting on real content (not just <body>) is what stops a loading skeleton
  // being captured. Pages with no landmark fall back to the document body.
  await waitForSelector(cdp, session, ready, 15000);
  await sleep(900); // let fonts, charts and hydration settle

  const metrics = await cdp.send("Page.getLayoutMetrics", {}, session);
  const full = Math.min(Math.ceil(metrics.cssContentSize.height), MAX_HEIGHT);

  const { data } = await cdp.send(
    "Page.captureScreenshot",
    {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: full, scale: VIEWPORT.scale },
    },
    session,
  );

  const file = join(OUT, `${slug}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  const kb = Math.round(Buffer.from(data, "base64").length / 1024);
  console.log(`  ${slug.padEnd(18)} ${route.padEnd(12)} ${width}x${full}  ${kb} KB`);
  return { slug, route, width, height: full };
}

// --- main -------------------------------------------------------------------

const PROBE = { email: "e2e-probe@test.local", password: "Probe12345" };
const EMPTY = { email: "e2e-other@test.local", password: "Probe12345" };

// Reachable without a session.
const PUBLIC_PAGES = [
  { slug: "10-signup", route: "/signup" },
  { slug: "11-login", route: "/login" },
  { slug: "13-not-found", route: "/no-such-page", ready: "body" },
];

// A mess that exists but has nothing in it yet.
const EMPTY_PAGES = [
  { slug: "12-empty-dashboard", route: "/dashboard" },
  { slug: "14-empty-members", route: "/members" },
];

const OWNER_PAGES = [
  { slug: "01-dashboard", route: "/dashboard" },
  { slug: "02-members", route: "/members" },
  { slug: "03-meals", route: "/meals" },
  { slug: "04-expenses", route: "/expenses" },
  { slug: "05-bills", route: "/bills" },
  { slug: "06-reports", route: "/reports" },
  { slug: "07-settings", route: "/settings" },
];

const MOBILE_PAGES = [
  { slug: "08-reports-mobile", route: "/reports", width: 414, height: 896 },
  { slug: "09-dashboard-mobile", route: "/dashboard", width: 414, height: 896 },
];

async function main() {
  try {
    await fetch(`${BASE}/login`, { redirect: "manual" });
  } catch {
    throw new Error(`No dev server at ${BASE}. Run "npm run dev" first.`);
  }

  mkdirSync(OUT, { recursive: true });
  const profile = join(tmpdir(), `messmate-shoot-${Date.now()}`);
  const browser = spawn(
    findBrowser(),
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--disable-lcd-text",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const shots = [];
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
    await cdp.send("Network.enable", {}, session);

    console.log("public pages (no session)");
    for (const p of PUBLIC_PAGES) shots.push(await shoot(cdp, session, p));

    console.log("owner pages");
    await signIn(cdp, session, { path: "/login", email: PROBE.email, password: PROBE.password });
    for (const p of OWNER_PAGES) shots.push(await shoot(cdp, session, p));
    for (const p of MOBILE_PAGES) shots.push(await shoot(cdp, session, p));

    console.log("empty mess (a brand new account)");
    // The second fixture exists with no members at all, so this is the genuine
    // first-run state rather than a mock-up of one.
    await cdp.send("Network.clearBrowserCookies", {}, session);
    await cdp.send("Storage.clearDataForOrigin", { origin: BASE, storageTypes: "all" }, session);
    await signIn(cdp, session, { path: "/login", email: EMPTY.email, password: EMPTY.password });
    for (const p of EMPTY_PAGES) shots.push(await shoot(cdp, session, p));

    writeFileSync(join(OUT, "manifest.json"), `${JSON.stringify(shots, null, 2)}\n`);
    console.log(`\n${shots.length} screenshots written to ${OUT}/`);

    // The fixtures only exist so the screens have something in them. Take them
    // back out here so a capture run can never leave test data sitting in the
    // database you actually use.
    await cleanupFixtures();
  } finally {
    browser.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** Removes the throwaway @test.local messes, leaving every real account alone. */
function cleanupFixtures() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--import", "./scripts/register.mjs", "scripts/clean-e2e.mjs"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => {
      if (code === 0) console.log("fixtures removed; the database is back to real accounts only");
      else console.warn(`could not remove the fixtures (exit ${code}); run npm run db:clean:e2e\n${out}`);
      resolve();
    });
  });
}

await main();
