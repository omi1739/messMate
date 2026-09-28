/*
 * Opens every modal in the app in a real browser and measures it.
 *
 * A modal cannot be judged from its source. Whether it traps focus, whether the
 * page behind it can still be scrolled, whether the panel fits the viewport, and
 * whether Escape reaches the topmost one of two nested dialogs are all
 * properties of the running page, and each of them has been wrong here at least
 * once without anything failing.
 *
 * Every overlay is opened the way a user opens it, by clicking its own trigger,
 * and then checked for the same things: a name, `aria-modal`, focus moved into
 * the panel, the page behind locked, the panel inside the viewport, no
 * horizontal overflow inside it, no mojibake in the copy, and Escape closing
 * only the topmost one and handing focus back to the trigger.
 *
 * Run against a throwaway database, since the fixtures it needs are real rows:
 *
 *   $env:MESSMATE_BASE_URL = "http://localhost:3100"
 *   node scripts/check-modals.mjs
 */

import { createTally, openPage, report, signIn, sleep } from "./lib/browser.mjs";

const BASE_URL = process.env.MESSMATE_BASE_URL ?? "http://localhost:3000";
const OWNER = { email: "e2e-probe@test.local", password: "Probe12345" };

/** Click the first element matching a text or attribute predicate. */
const byText = (text) =>
  `const el = [...document.querySelectorAll("button, [role=button]")].find((b) => b.textContent.trim() === ${JSON.stringify(text)});`;
const byAriaPrefix = (prefix) =>
  `const el = document.querySelector(\`button[aria-label^=${JSON.stringify(prefix)}]\`);`;

/**
 * Each target names the page it lives on, how to open it, and the dialog it
 * expects to find.
 *
 * `prepare` runs first, because some overlays are only reachable through a
 * view switch. The month grid is behind "Whole month" now that meal entry is
 * day-first, and the cell dialogs live in that grid. Getting this wrong produces
 * a check that reports "no trigger" and reads like a broken app, which is how a
 * stale selector here once looked like five broken modals when the app was fine.
 *
 * `expectLabel` is the dialog's own accessible name. It is asserted rather than
 * assumed, so a trigger that opens the *wrong* dialog fails instead of passing
 * on "a dialog appeared".
 */
const TARGETS = [
  {
    group: "members",
    path: "/members",
    name: "add member",
    expectLabel: "Add member",
    open: `${byText("Add member")} return hit(el);`,
  },
  {
    group: "members",
    path: "/members",
    name: "edit member",
    expectLabel: "Edit ",
    open: `${byAriaPrefix("Edit ")} return hit(el);`,
  },
  {
    group: "meals",
    path: "/meals",
    name: "a member's cell in the month grid",
    prepare: `${byText("Whole month")} el?.click(); return true;`,
    expectLabel: "Meals for ",
    open: `const el = document.querySelector('button[aria-label*="Edit."]'); return hit(el);`,
  },
  {
    group: "meals",
    path: "/meals",
    name: "fill a whole day",
    prepare: `${byText("Whole month")} el?.click(); return true;`,
    expectLabel: "Fill a whole day",
    open: `${byText("Fill a whole day")} return hit(el);`,
  },
  {
    group: "expenses",
    path: "/expenses",
    name: "edit expense",
    expectLabel: "Edit expense",
    open: `${byAriaPrefix("Edit ")} return hit(el);`,
  },
  {
    group: "expenses",
    path: "/expenses",
    name: "delete expense",
    expectLabel: "Delete this expense?",
    open: `${byAriaPrefix("Delete ")} return hit(el);`,
  },
  {
    group: "bills",
    path: "/bills",
    name: "edit extra charge",
    expectLabel: "Edit extra charge",
    open: `${byAriaPrefix("Edit ")} return hit(el);`,
  },
  {
    group: "reports",
    path: "/reports",
    name: "record a payment",
    expectLabel: "Payment from ",
    open: `${byAriaPrefix("Record a payment from ")} return hit(el);`,
  },
];

/** The navigation drawer only exists below the `lg` breakpoint. */
const DRAWER = {
  group: "shell",
  path: "/dashboard",
  name: "navigation drawer",
  only: "mobile",
  open: `const el = document.querySelector('button[aria-label="Open navigation"]'); return hit(el);`,
};

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 900, mobile: false },
  { label: "mobile", width: 390, height: 844, mobile: true },
];

/** Everything worth knowing about the topmost dialog, measured from the page. */
const SNAPSHOT = `(() => {
  const panels = [...document.querySelectorAll('[role=dialog]')];
  const panel = panels[panels.length - 1];
  if (!panel) return { count: 0 };
  const r = panel.getBoundingClientRect();
  const active = document.activeElement;
  const text = panel.textContent || "";
  return {
    count: panels.length,
    label: (panel.getAttribute("aria-label") || "").trim(),
    ariaModal: panel.getAttribute("aria-modal"),
    focusInside: panel.contains(active),
    // Booleans only: the harness returns everything by value, and a DOM node
    // cannot be serialised back out of the browser.
    hasFirstField: !!panel.querySelector('input:not([type="hidden"]), textarea, select'),
    focusOnFirstField:
      panel.querySelector('input:not([type="hidden"]), textarea, select') === active,
    activeName: active
      ? active.getAttribute("aria-label") || active.textContent?.trim()?.slice(0, 30) || active.tagName
      : null,
    bodyOverflow: document.body.style.overflow,
    fitsWidth: r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
    fitsHeight: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5,
    box: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
    viewport: { w: window.innerWidth, h: window.innerHeight },
    overflowsX: panel.scrollWidth > panel.clientWidth + 1,
    widest: Math.round(Math.max(0, ...[...panel.querySelectorAll("*")].map((e) => e.getBoundingClientRect().right))),
    mojibake: text.includes("\\uFFFD"),
  };
})()`;

const triggerRestored = `(() => {
  const t = document.querySelector("[data-probe-trigger]");
  const back = !!t && document.activeElement === t;
  t?.removeAttribute("data-probe-trigger");
  return back;
})()`;

async function pressEscape(page) {
  for (const type of ["keyDown", "keyUp"]) {
    await page.cdp.send(
      "Input.dispatchKeyEvent",
      { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 },
      page.session,
    );
  }
}

async function checkTarget(page, tally, target, viewport) {
  const tag = `${viewport.label}: ${target.name}`;

  await page.goto(target.path, { ready: `document.readyState === "complete"` });

  if (target.prepare) {
    const prepared = await page.evaluate(`(() => {
      const hit = (el) => { if (!el) return false; el.click(); return true; };
      ${target.prepare}
    })()`);
    if (!prepared) {
      tally.check(`${tag} can be reached`, false, "the view switch it needs is missing");
      return;
    }
    await sleep(600);
  }

  // A real click focuses the control it lands on. `el.click()` does not, so the
  // focus is set explicitly here: without it the app is asked to restore focus
  // to an element the page never focused, and every overlay "fails" a check
  // that no user could ever have failed.
  const opened = await page.evaluate(`(() => {
    const hit = (el) => { if (!el) return false; el.setAttribute("data-probe-trigger", "1"); el.focus(); el.click(); return true; };
    ${target.open}
  })()`);

  if (!opened) {
    tally.check(`${tag} has a trigger to click`, false, "no matching trigger on the page");
    return;
  }

  try {
    await page.waitUntil(
      `document.querySelectorAll("[role=dialog]").length >= ${target.min ?? 1}`,
      `${tag} to open`,
    );
  } catch {
    tally.check(`${tag} opens`, false, "no dialog appeared");
    await page.evaluate(`document.querySelectorAll("[data-probe-trigger]").forEach((t) => t.removeAttribute("data-probe-trigger"))`);
    return;
  }
  // The hook focuses the first control on a timer, so measure after it.
  await sleep(320);

  const s = await page.evaluate(SNAPSHOT);
  const where = `${s.viewport.w}x${s.viewport.h} panel ${s.box.w}x${s.box.h} at ${s.box.left},${s.box.top}`;

  tally.check(`${tag} opens`, s.count >= (target.min ?? 1), `count ${s.count}`);
  if (target.expectLabel) {
    tally.check(
      `${tag} opens the right dialog`,
      s.label.includes(target.expectLabel),
      `aria-label "${s.label}"`,
    );
  }
  tally.check(`${tag} has an accessible name`, s.label.length > 0, `aria-label "${s.label}"`);
  tally.check(`${tag} declares aria-modal`, s.ariaModal === "true", `aria-modal=${s.ariaModal}`);
  tally.check(`${tag} takes focus`, s.focusInside, `focus on ${s.activeName}`);
  if (s.hasFirstField) {
    tally.check(
      `${tag} opens with the caret in its first field`,
      s.focusOnFirstField,
      s.focusOnFirstField ? "" : `focus was on ${s.activeName}`,
    );
  }
  tally.check(`${tag} locks the page behind it`, s.bodyOverflow === "hidden", `body overflow: ${s.bodyOverflow || "(none)"}`);
  tally.check(`${tag} fits the viewport`, s.fitsWidth && s.fitsHeight, where);
  tally.check(`${tag} does not scroll sideways`, !s.overflowsX, `widest child right edge ${s.widest} in ${s.viewport.w}`);
  tally.check(`${tag} has no broken characters`, !s.mojibake, s.mojibake ? "the copy contains a replacement character" : "");

  await pressEscape(page);

  const expected = (target.min ?? 1) - 1;
  try {
    await page.waitUntil(
      `document.querySelectorAll("[role=dialog]").length === ${expected}`,
      `${tag} to close on Escape`,
    );
  } catch {
    const left = await page.evaluate(`document.querySelectorAll("[role=dialog]").length`);
    tally.check(`${tag} closes on Escape`, false, `${left} dialog(s) left open`);
    await page.evaluate(`document.querySelectorAll("[data-probe-trigger]").forEach((t) => t.removeAttribute("data-probe-trigger"))`);
    return;
  }

  tally.check(`${tag} closes on Escape`, true);

  if (expected === 0) {
    const back = await page.evaluate(triggerRestored);
    tally.check(`${tag} returns focus to the trigger`, back, back ? "" : "focus went elsewhere");
    const overflow = await page.evaluate(`document.body.style.overflow`);
    tally.check(`${tag} releases the scroll lock`, overflow !== "hidden", `body overflow: ${overflow || "(none)"}`);
  }
}

/**
 * Two dialogs at once. Escape belongs to the inner one only: closing both would
 * throw away the edit form behind it with whatever the user had typed.
 */
async function checkNestedEscape(page, tally, viewport) {
  const tag = `${viewport.label}: delete confirmation inside the edit form`;

  await page.goto("/members", { ready: `!!document.querySelector("button")` });
  const opened = await page.evaluate(`(() => {
    const edit = document.querySelector('button[aria-label^="Edit "]');
    if (!edit) return false;
    edit.click();
    return true;
  })()`);
  if (!opened) {
    tally.check(`${tag} can be reached`, false, "no member row to edit");
    return;
  }

  await page.waitUntil(`document.querySelectorAll("[role=dialog]").length === 1`, "the edit form");
  await sleep(300);

  const inner = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Delete");
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!inner) {
    tally.check(`${tag} can be reached`, false, "the edit form has no delete trigger");
    return;
  }

  await page.waitUntil(`document.querySelectorAll("[role=dialog]").length === 2`, "the confirmation");
  await sleep(300);
  const both = await page.evaluate(`document.querySelectorAll("[role=dialog]").length`);
  tally.check(`${tag} stacks`, both === 2, `${both} dialogs`);

  await pressEscape(page);
  try {
    await page.waitUntil(`document.querySelectorAll("[role=dialog]").length === 1`, "only the inner dialog to close");
    const stillThere = await page.evaluate(`document.querySelectorAll("[role=dialog]")[0]?.textContent?.includes("Cancel") ?? false`);
    tally.check(`${tag} closes only the inner dialog`, stillThere, "the edit form survived");
  } catch {
    tally.check(`${tag} closes only the inner dialog`, false, "both dialogs closed on one Escape");
  }

  // Put the page back the way it was for whatever runs next.
  await pressEscape(page);
  await sleep(200);
}

async function main() {
  const tally = createTally();
  const page = await openPage({ port: 9412, baseUrl: BASE_URL, label: "modals" });

  try {
    await signIn(page, { email: OWNER.email, password: OWNER.password, baseUrl: BASE_URL });

    for (const viewport of VIEWPORTS) {
      console.log(`\n── ${viewport.label} ${viewport.width}x${viewport.height} ──`);
      await page.cdp.send(
        "Emulation.setDeviceMetricsOverride",
        {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.mobile ? 3 : 1,
          mobile: viewport.mobile,
        },
        page.session,
      );

      const visited = new Set();
      for (const target of [...TARGETS, DRAWER]) {
        if (target.only && target.only !== viewport.label) continue;
        void visited;
        await checkTarget(page, tally, target, viewport);
      }

      await checkNestedEscape(page, tally, viewport);
    }

    const noisy = page.problems.filter((p) => !/favicon/i.test(p));
    tally.check("no exceptions or 5xx while opening every modal", noisy.length === 0, noisy.slice(0, 3).join(" | "));
  } finally {
    page.close();
  }

  report(tally);
}

await main();
