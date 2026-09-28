/*
 * Meal entry, driven through a real browser.
 *
 * The quick log replaced a flow that opened a dialog per member and asked for
 * three typed numbers, and it is easy to reintroduce the exact bug that shipped
 * in the first draft: the draft object uses `b`/`l`/`d` while the server action
 * reads `breakfast`/`lunch`/`dinner`, so the UI cycles happily and the database
 * stays empty. Nothing in a unit test can see that, because the two shapes only
 * meet across a network round trip.
 *
 * So this asserts what the *server* holds, by reloading the page after every tap
 * instead of trusting the optimistic state. It also checks that filling a day
 * does not destroy a half-meal, which is the whole reason the fill button is
 * allowed to be safe.
 *
 * Needs the dev server on :3000 and the db:seed:e2e fixtures.
 */

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const PORT = 9345;
const OWNER = { email: "e2e-probe@test.local", password: "Probe12345" };

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
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function check(name, pass, detail = "") {
  if (pass) passed += 1;
  else failed += 1;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.log("  FAIL no Chrome or Edge found; set CHROME_PATH to run this test");
    process.exitCode = 1;
    return;
  }

  const profile = join(tmpdir(), `messmate-meals-${Date.now()}`);
  const chrome = spawn(
    browser,
    [
      `--remote-debugging-port=${PORT}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore", detached: false },
  );

  let cdp = null;
  try {
    cdp = await connect();
    // The socket has to be open before anything can be sent on it.
    await cdp.ready;
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const session = sessionId;

    await cdp.send("Page.enable", {}, session);
    await cdp.send("Runtime.enable", {}, session);
    await cdp.send("Network.enable", {}, session);

    const problems = [];
    cdp.on("Runtime.exceptionThrown", (p) => {
      problems.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception");
    });
    cdp.on("Network.responseReceived", (p) => {
      if (p.response.status >= 500) problems.push(`${p.response.status} ${p.response.url}`);
    });

    async function evaluate(expression) {
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

    async function goto(path, settle = 1800) {
      const loaded = cdp.once("Page.loadEventFired", 30000).catch(() => null);
      await cdp.send("Page.navigate", { url: `${BASE}${path}` }, session);
      await loaded;
      await sleep(settle);
    }

    // -------------------------------------------------------------- sign in
    await cdp.send("Network.clearBrowserCookies", {}, session);
    await goto("/login", 1500);
    await evaluate(`(() => {
      const set = (sel, v) => {
        const el = document.querySelector(sel);
        Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      set("input[type=email]", ${JSON.stringify(OWNER.email)});
      set("input[type=password]", ${JSON.stringify(OWNER.password)});
      document.querySelector("form").requestSubmit();
    })()`);
    for (let i = 0; i < 40; i++) {
      if ((await evaluate("location.pathname")) === "/dashboard") break;
      await sleep(300);
    }
    check("signed in as the owner fixture", (await evaluate("location.pathname")) === "/dashboard");

    // ------------------------------------------------- the quick log is default
    await goto("/meals", 2200);
    check(
      "quick log is the default view",
      (await evaluate(`document.querySelector('[role=tab][aria-selected=true]')?.textContent?.trim()`)) === "Quick log",
    );
    const rows = await evaluate(`document.querySelectorAll('tbody tr').length`);
    const chips = await evaluate(`document.querySelectorAll('button[aria-label*="Tap to change"]').length`);
    check("a row per member", rows > 0, `${rows} rows`);
    check("three tappable chips per member", chips === rows * 3, `${chips} chips`);
    check("no dialog to get started", (await evaluate(`document.querySelectorAll('[role=dialog]').length`)) === 0);
    check("the day defaults to today", await evaluate(`[...document.querySelectorAll('p')].some((p) => p.textContent.trim() === "Today")`));

    // ------------------------------------------------------------- the cycle
    const chip = `document.querySelector('button[aria-label*="Asha"][aria-label*="Breakfast"]')`;
    const readMeal = (meal) =>
      evaluate(`(() => {
        const b = document.querySelector('button[aria-label*="Asha"][aria-label*="${meal}"]');
        if (!b) return null;
        const m = b.getAttribute("aria-label").match(/: (none|full|half)\\./);
        return m ? m[1] : null;
      })()`);
    const read = () => readMeal("Breakfast");

    /*
     * Every assertion here has to read the database, but the writes are chained,
     * so the second write of a pair is still queued when the first lands.
     * Navigating aborts whatever is in flight, which silently drops taps and
     * looks exactly like a lost-update bug. The UI already says when a write is
     * outstanding (`aria-busy` covers both the chips and the bulk-fill button),
     * so wait for that to clear before reloading, then confirm the day has
     * stopped moving before trusting a value.
     */
    const dayFingerprint = () =>
      evaluate(`[...document.querySelectorAll("tbody tr")]
        .map((r) => [...r.querySelectorAll('button[aria-label*="Tap to change"]')]
          .map((b) => b.getAttribute("aria-label").match(/: (none|full|half)\\./)[1])
          .join(""))
        .join("|")`);
    async function awaitWrites(timeout = 25000) {
      const deadline = Date.now() + timeout;
      for (;;) {
        const busy = await evaluate(`document.querySelectorAll('button[aria-busy=true]').length`);
        if (busy === 0) {
          // A chained write only sets its flag on the next microtask, so one
          // clean reading can still precede the write that was just queued.
          await sleep(250);
          if ((await evaluate(`document.querySelectorAll('button[aria-busy=true]').length`)) === 0) return true;
        }
        if (Date.now() > deadline) return false;
        await sleep(250);
      }
    }
    async function settleDay(attempts = 6) {
      let previous = null;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        await awaitWrites();
        await goto("/meals", 1200);
        const current = await dayFingerprint();
        if (current === previous) return current;
        previous = current;
      }
      return previous;
    }
    const countEnabledClears = () =>
      evaluate(`[...document.querySelectorAll('button[aria-label*="Clear "]')].filter((b) => !b.disabled).length`);

    /*
     * A run must not inherit state from the run before it, so preconditions are
     * re-established and verified rather than assumed: press the button, wait
     * for the day to settle, look again.
     */
    async function ensureCleared(selector, readOne, attempts = 4) {
      for (let attempt = 0; attempt < attempts && (await readOne()) !== "none"; attempt += 1) {
        await evaluate(selector);
        await settleDay();
      }
      return readOne();
    }

    // Start from a known-empty row. Use its clear button: clicking every chip
    // once lands somewhere arbitrary, which makes the expected cycle unknowable.
    const cleared = await ensureCleared(
      `document.querySelector('button[aria-label*="Clear Asha"]').click()`,
      read,
    );
    check("clearing a row empties it on the server", cleared === "none", `breakfast is ${cleared}`);

    for (const [index, want] of ["full", "half", "none", "full"].entries()) {
      await evaluate(`${chip}.click()`);
      await settleDay();
      const got = await read();
      check(`tap ${index + 1} persists as ${want}`, got === want, `server says ${got}`);
    }

    // Two taps in one tick, with no reload in between: a real user logging
    // lunch and dinner as they eat. The reload after clearing matters, because
    // it remounts the component and rebuilds the row from the server.
    await evaluate(`document.querySelector('button[aria-label*="Clear Asha"]').click()`);
    await settleDay();
    if ((await read()) !== "none") {
      await evaluate(`document.querySelector('button[aria-label*="Clear Asha"]').click()`);
      await settleDay();
    }
    await evaluate(`(() => {
      const row = [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Asha"));
      const tap = (meal) => [...row.querySelectorAll('button[aria-label*="Tap to change"]')].find((b) => b.getAttribute("aria-label").includes(meal));
      tap("Lunch").click(); tap("Dinner").click();
    })()`);
    await settleDay();
    const lunchValue = await readMeal("Lunch");
    const dinnerValue = await readMeal("Dinner");
    check("lunch and dinner both saved", lunchValue === "full" && dinnerValue === "full", `lunch ${lunchValue}, dinner ${dinnerValue}`);

    // The page header also has date-like text, so read the day switcher's own
    // label rather than the first <p> on the page.
    const dayLabel = () =>
      evaluate(`(() => {
        const el = [...document.querySelectorAll("p")].find((p) => /^[A-Z][a-z]{2} \\d{1,2} [A-Z][a-z]+$/.test(p.textContent.trim()));
        return el ? el.textContent.trim() : null;
      })()`);
    const startDay = await dayLabel();
    await evaluate(`[...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Previous day").click()`);
    await sleep(600);
    const previousDay = await dayLabel();
    check("stepping to the previous day changes the day", previousDay !== startDay, `${startDay} -> ${previousDay}`);
    await evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Jump to today")).click()`);
    await sleep(600);
    check("jump to today comes back", (await dayLabel()) === startDay, await dayLabel());

    // Start the fill from a known state, so the run does not depend on whatever
    // the previous run left in the database.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await settleDay();
      if ((await countEnabledClears()) === 0) break;
      await evaluate(
        `[...document.querySelectorAll('button[aria-label*="Clear "]')].filter((b) => !b.disabled).forEach((b) => b.click())`,
      );
    }
    await settleDay();
    const leftFilled = await countEnabledClears();
    check("every row can be cleared", leftFilled === 0, `${leftFilled} rows still filled`);

    // The cycle is none -> full -> half -> none, so the number of taps needed to
    // land on half depends on where the cell started. Step until it is there.
    for (let attempt = 0; attempt < 4 && (await read()) !== "half"; attempt += 1) {
      await evaluate(`${chip}.click()`);
      await settleDay();
    }
    check("a row can be left half", (await read()) === "half", `breakfast is ${await read()}`);

    const dayTotal = () => evaluate(`document.querySelector("tfoot").textContent.replace(/\\s+/g, " ").trim()`);
    const before = await dayTotal();
    await evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Everyone ate")).click()`);
    await settleDay();
    check("Everyone ate fills the day in one tap", before !== (await dayTotal()), `${before} -> ${await dayTotal()}`);

    check("Everyone ate leaves a half-meal alone", (await read()) === "half", `breakfast is ${await read()}`);

    const otherFilled = await evaluate(`(() => {
      const rows = [...document.querySelectorAll("tbody tr")];
      const other = rows.find((r) => !r.textContent.includes("Asha"));
      if (!other) return null;
      return [...other.querySelectorAll('button[aria-label*="Tap to change"]')]
        .map((b) => b.getAttribute("aria-label").match(/: (none|full|half)\\./)[1]);
    })()`);
    check(
      "Everyone ate filled the other rows",
      Array.isArray(otherFilled) && otherFilled.includes("full"),
      JSON.stringify(otherFilled),
    );

    await evaluate(`[...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.includes("Whole month")).click()`);
    await sleep(900);
    check("whole month grid still renders", await evaluate(`!!document.querySelector("table caption")`));
    check("grid cells are still editable", await evaluate(`!!document.querySelector('button[aria-label*="Edit"]')`));
    check("grid keeps its own fill-a-day helper", await evaluate(`[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Fill a whole day"))`));

    check("no exceptions or 5xx while driving all of this", problems.length === 0, problems.slice(0, 2).join(" | "));
  } finally {
    try { cdp?.ws.close(); } catch { /* best effort */ }
    chrome.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** Waits for the debugging port, then opens one page target. */
async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return createCdp(page.webSocketDebuggerUrl);
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error("Chrome did not expose a debugging port");
}

function createCdp(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error(`cannot connect to ${url}`)), { once: true });
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    }
  });
  return {
    ws,
    ready,
    send(method, params = {}, sessionId) {
      const n = ++id;
      const payload = sessionId ? { id: n, method, params, sessionId } : { id: n, method, params };
      ws.send(JSON.stringify(payload));
      return new Promise((resolve, reject) => {
        pending.set(n, { resolve, reject });
        setTimeout(() => {
          if (pending.has(n)) {
            pending.delete(n);
            reject(new Error(`CDP timeout: ${method}`));
          }
        }, 45000);
      });
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(fn);
    },
    once(method, timeout = 30000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeout);
        this.on(method, (p) => {
          clearTimeout(timer);
          resolve(p);
        });
      });
    },
  };
}

console.log("meal entry through a real browser");
await main();

console.log(`\n${passed} passed, ${failed ? `${failed} failed` : "all green"}`);
if (failed) process.exitCode = 1;
