/*
 * Measures the app the way a phone shows it.
 *
 * "It works on mobile" is not something the source can answer. A desktop browser
 * resized to 390px still lays out like a desktop browser; a phone is a different
 * width, a different pixel density, and a thumb instead of a cursor. The things
 * that break are the same every time — something wider than the screen, a
 * control too small to hit, a page that zooms out because the viewport was never
 * declared — and none of them show up in a screenshot taken at 1280px.
 *
 * So this drives a real browser at real device sizes and measures the document
 * rather than eyeballing it:
 *
 *   - the viewport must be declared as device-width, or a phone renders the page
 *     at desktop width and scales it down into unreadable text
 *   - the document must not scroll sideways, and any element that reaches past
 *     the edge is named so it can be found, with elements inside a deliberately
 *     scrollable strip excluded so a wide table is not reported as a bug
 *   - every control a thumb has to hit must clear 24x24, the WCAG 2.2 minimum
 *   - no text may render below 11px
 *
 * Run against a throwaway database, since the rows it measures are real:
 *
 *   $env:MESSMATE_BASE_URL = "http://localhost:3100"
 *   node scripts/check-mobile.mjs
 */

import { createTally, openPage, report, signIn, sleep } from "./lib/browser.mjs";

const BASE_URL = process.env.MESSMATE_BASE_URL ?? "http://localhost:3000";
const OWNER = { email: "e2e-probe@test.local", password: "Probe12345" };

/** Real device sizes, narrowest first: the small phone is where layouts break. */
const DEVICES = [
  { label: "small android", width: 360, height: 740, scale: 3 },
  { label: "iphone", width: 390, height: 844, scale: 3 },
  { label: "large iphone", width: 430, height: 932, scale: 3 },
];

const ROUTES = [
  "/",
  "/login",
  "/signup",
  "/dashboard",
  "/meals",
  "/members",
  "/expenses",
  "/bills",
  "/reports",
  "/settings",
];

/** WCAG 2.2 SC 2.5.8, the minimum a pointer target may be. */
const MIN_TARGET = 24;
const MIN_FONT = 11;

/** A short, greppable description of an element, for the failure message. */
const DESCRIBE = `((el) => {
  const id = el.id ? "#" + el.id : "";
  const cls = typeof el.className === "string" && el.className
    ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".")
    : "";
  const name = el.getAttribute("aria-label") || (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 24);
  return el.tagName.toLowerCase() + id + cls + (name ? ' "' + name + '"' : "");
})`;

const MEASURE = `((describe) => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const scrollsSideways = doc.scrollWidth > vw + 1;

  // An element wider than the screen only matters if nothing above it is
  // deliberately scrollable: a wide table inside an overflow-x strip is a
  // feature, and reporting it would send someone hunting a bug that isn't there.
  const clipped = (el) => {
    let node = el.parentElement;
    while (node) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden" || overflowX === "clip") return true;
      node = node.parentElement;
    }
    return false;
  };

  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (clipped(el)) continue;
    offenders.push({ how: describe(el), right: Math.round(r.right), width: Math.round(r.width) });
    if (offenders.length >= 6) break;
  }

  // Controls a thumb has to hit. Links inside running prose are exempt, as they
  // are in the standard: a sentence full of links cannot have 24px tap targets.
  const tooSmall = [];
  let small = 0;
  for (const el of document.querySelectorAll('button, [role="button"], [role="tab"], a[href], input, select, textarea, [role="switch"], [role="checkbox"]')) {
    if (el.closest("p, li, dd, figcaption, [data-prose]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width < ${MIN_TARGET} || r.height < ${MIN_TARGET}) {
      tooSmall.push({ how: describe(el), w: Math.round(r.width), h: Math.round(r.height) });
    } else if (r.width < 32 || r.height < 32) {
      small += 1;
    }
  }

  const tinyText = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length > 0) continue;
    const text = (el.textContent || "").trim();
    if (!text) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size >= ${MIN_FONT} || !Number.isFinite(size)) continue;
    tinyText.push({ how: describe(el), px: Math.round(size * 10) / 10 });
    if (tinyText.length >= 4) break;
  }

  const viewport = document.querySelector('meta[name="viewport"]');

  return {
    vw,
    scrollWidth: doc.scrollWidth,
    scrollsSideways,
    offenders: offenders.slice(0, 6),
    tooSmall: tooSmall.slice(0, 6),
    tooSmallCount: tooSmall.length,
    small,
    tinyText: tinyText.slice(0, 4),
    viewportContent: viewport ? viewport.getAttribute("content") : null,
  };
})`;

function describeList(list, format) {
  return list.map(format).join(", ");
}

async function main() {
  const tally = createTally();
  const page = await openPage({ port: 9421, baseUrl: BASE_URL, label: "mobile" });

  try {
    await signIn(page, { email: OWNER.email, password: OWNER.password, baseUrl: BASE_URL });

    for (const device of DEVICES) {
      console.log(`\n── ${device.label} ${device.width}x${device.height} @${device.scale}x ──`);
      await page.cdp.send(
        "Emulation.setDeviceMetricsOverride",
        {
          width: device.width,
          height: device.height,
          deviceScaleFactor: device.scale,
          mobile: true,
          screenWidth: device.width,
          screenHeight: device.height,
        },
        page.session,
      );
      await page.cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, page.session);

      for (const route of ROUTES) {
        await page.goto(route, { settle: 900, ready: `document.readyState === "complete"` });
        await sleep(350);

        const m = await page.evaluate(`(${MEASURE})(${DESCRIBE})`);
        const tag = `${device.label} ${route}`;

        tally.check(
          `${tag} declares a device-width viewport`,
          !!m.viewportContent && /width\s*=\s*device-width/.test(m.viewportContent),
          m.viewportContent ? `content="${m.viewportContent}"` : "no viewport meta tag at all",
        );
        tally.check(
          `${tag} does not scroll sideways`,
          !m.scrollsSideways,
          m.scrollsSideways
            ? `document is ${m.scrollWidth}px wide in ${m.vw}px: ${describeList(
                m.offenders,
                (o) => `${o.how} (${o.width}px)`,
              )}`
            : "",
        );
        tally.check(
          `${tag} has no tiny tap targets`,
          m.tooSmallCount === 0,
          m.tooSmallCount === 0
            ? `${m.small} more between ${MIN_TARGET} and 32px`
            : `${m.tooSmallCount} under ${MIN_TARGET}px: ${describeList(m.tooSmall, (o) => `${o.how} ${o.w}x${o.h}`)}`,
        );
        tally.check(
          `${tag} keeps text legible`,
          m.tinyText.length === 0,
          m.tinyText.length === 0 ? "" : describeList(m.tinyText, (t) => `${t.how} ${t.px}px`),
        );
      }
    }

    const noisy = page.problems.filter((p) => !/favicon/i.test(p));
    tally.check("no exceptions or 5xx at any device size", noisy.length === 0, noisy.slice(0, 3).join(" | "));
  } finally {
    page.close();
  }

  report(tally);
}

await main();
