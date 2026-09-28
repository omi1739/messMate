/*
 * Headless browser harness shared by the UI checks.
 *
 * It owns the parts that are easy to get subtly wrong and impossible to notice
 * when they are wrong: waiting for the socket to open before anything is sent,
 * waiting for the debugging port before connecting, and giving every CDP call a
 * timeout. The callers get `evaluate`, `goto`, and a way to record page errors.
 *
 * Nothing here runs on import, so importing it from a test file does not start a
 * browser. That was a real trap: an earlier check imported `check-dark.mjs` to
 * reuse its client, which ran the entire dark-theme audit as a side effect.
 */

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function findBrowser() {
  for (const candidate of CHROME_CANDIDATES) if (existsSync(candidate)) return candidate;
  return null;
}

/**
 * Chrome spawns a tree of helper processes, and on Windows `child.kill()` only
 * terminates the one it spawned, so a run leaves a browser's worth of orphans
 * behind. `taskkill /T` takes the tree with it. The other platforms are happy
 * with a plain signal, so this stays conditional rather than reaching for a
 * Windows-only tool everywhere.
 */
function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch { /* fall through to the signal */ }
  }
  try { child.kill(); } catch { /* best effort */ }
}

function cleanup(cdp, chrome, profile) {
  try { cdp?.ws.close(); } catch { /* best effort */ }
  killTree(chrome);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
}

/**
 * Opens a headless browser and returns a page driver bound to one tab.
 * The caller is responsible for calling `close()`.
 */
export async function openPage({ port, baseUrl, label = "check" }) {
  const browser = findBrowser();
  if (!browser) throw new Error("no Chrome or Edge found; set CHROME_PATH to run this test");

  const profile = join(tmpdir(), `messmate-${label}-${Date.now()}`);
  const chrome = spawn(
    browser,
    [
      `--remote-debugging-port=${port}`,
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
    cdp = await connect(port);
    // Nothing can be sent before the socket is open.
    await cdp.ready;

    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const session = sessionId;

    await cdp.send("Page.enable", {}, session);
    await cdp.send("Runtime.enable", {}, session);
    await cdp.send("Network.enable", {}, session);

    const problems = [];
    cdp.on("Runtime.exceptionThrown", (p) => {
      problems.push(
        p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception",
      );
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
        throw new Error(
          exceptionDetails.text + " " + (exceptionDetails.exception?.description ?? ""),
        );
      }
      return result.value;
    }

    /**
     * Navigates and waits for the page to be usable. A fixed pause is not
     * enough on a dev server: the route can still be compiling when the pause
     * ends, and a check that reads the DOM at that point sees the outgoing page
     * and fails for no reason. Pass `ready` to wait for something real.
     */
    async function goto(path, { settle = 1500, ready } = {}) {
      const loaded = cdp.once("Page.loadEventFired", 45000).catch(() => null);
      await cdp.send("Page.navigate", { url: `${baseUrl}${path}` }, session);
      await loaded;
      await sleep(settle);
      if (ready) await waitUntil(ready, `the page at ${path}`);
    }

    /** Polls an expression until it is truthy, so nothing depends on a guess. */
    async function waitUntil(expression, label, timeout = 45000) {
      const deadline = Date.now() + timeout;
      for (;;) {
        let value = false;
        try {
          value = await evaluate(expression);
        } catch {
          // The document can be swapped out mid-poll, which is not a failure.
        }
        if (value) return true;
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
        await sleep(200);
      }
    }

    return {
      cdp,
      session,
      problems,
      evaluate,
      goto,
      waitUntil,
      close() {
        cleanup(cdp, chrome, profile);
      },
    };
  } catch (error) {
    cleanup(cdp, chrome, profile);
    throw error;
  }
}

/**
 * Signs in through the real form and waits for the redirect to land, so no
 * check depends on a hand-built cookie.
 *
 * The wait is generous on purpose. A dev server compiling the login route for
 * the first time after an edit can take longer than a fixed short wait allows,
 * and failing there reads like a broken login when nothing is wrong.
 */
export async function signIn(page, { email, password, baseUrl, timeout = 60000 }) {
  await page.cdp.send("Network.clearBrowserCookies", {}, page.session);
  await page.goto("/login", { settle: 1200, ready: `!!document.querySelector("input[type=email]")` });

  const before = await page.evaluate(`location.pathname`);
  if (before !== "/login") {
    throw new Error(`expected to start on /login, but the browser is on ${before}`);
  }

  await page.evaluate(`(() => {
    const set = (sel, value) => {
      const el = document.querySelector(sel);
      Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("input[type=email]", ${JSON.stringify(email)});
    set("input[type=password]", ${JSON.stringify(password)});
    document.querySelector("form").requestSubmit();
  })()`);

  const deadline = Date.now() + timeout;
  for (;;) {
    const at = await page.evaluate(`location.pathname`);
    if (at && at !== "/login") return true;
    if (Date.now() > deadline) break;
    await sleep(400);
  }

  const complaint = await page
    .evaluate(`[...document.querySelectorAll("p, [role=alert]")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 3).join(" | ")`)
    .catch(() => "");
  throw new Error(
    `still on /login after ${Math.round(timeout / 1000)}s signing in as ${email} at ${baseUrl}` +
      (complaint ? `; the page said: ${complaint}` : ""),
  );
}

async function connect(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const target = list.find((t) => t.type === "page");
      if (target?.webSocketDebuggerUrl) return createCdp(target.webSocketDebuggerUrl);
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

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method) {
      for (const fn of listeners.get(message.method) ?? []) fn(message.params);
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
        this.on(method, (params) => {
          clearTimeout(timer);
          resolve(params);
        });
      });
    },
  };
}

/**
 * Pass/fail tally with the same output shape as the existing checks.
 *
 * Keep this object by reference and read `.passed`/`.failed` at the end. An
 * earlier version exported plain numbers that callers destructured at the top of
 * the file; every check passed and the summary still printed "0 passed" because
 * the destructured copy was captured before the first check ran. `report` treats
 * a zero count as a failure so that mistake can never look green again.
 */
export function createTally() {
  const tally = {
    passed: 0,
    failed: 0,
    check(name, pass, detail = "") {
      if (pass) tally.passed += 1;
      else tally.failed += 1;
      console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
    },
  };
  return tally;
}

/** Prints the summary and sets a non-zero exit code when anything is wrong. */
export function report(tally) {
  if (tally.passed === 0) {
    console.log("\n0 checks ran, which is always a failure, not a pass");
    process.exitCode = 1;
    return;
  }
  console.log(`\n${tally.passed} passed, ${tally.failed ? `${tally.failed} failed` : "all green"}`);
  if (tally.failed) process.exitCode = 1;
}
