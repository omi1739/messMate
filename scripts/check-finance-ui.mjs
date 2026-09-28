/*
 * Expense and bill entry, driven through a real browser.
 *
 * The same reasoning as the meal check applies: the quick-add forms were added
 * to stop people opening a dialog per line, and the two failure modes that
 * matter cannot be seen in a unit test.
 *
 * First, that the write actually lands. These forms reset themselves on success,
 * so a form that quietly fails to submit still looks like it worked. Every add
 * here is confirmed by reloading and reading the list back.
 *
 * Second, the shared `useActionForm` behaviour. React resets a `<form action>`
 * once the action settles, whatever the outcome, so a rejected entry has to put
 * the typed values back. Getting that wrong is silent data loss: the save looks
 * like it worked, and the line is gone.
 *
 * Every wait here is on observed state rather than a fixed sleep, because a
 * reload while a write is in flight drops it and looks exactly like a bug.
 *
 * Needs the dev server on :3000 and the db:seed:e2e fixtures.
 */

import { openPage, signIn, sleep, createTally, report } from "./lib/browser.mjs";

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const PORT = 9346;
const OWNER = { email: "e2e-probe@test.local", password: "Probe12345" };

/**
 * The utility-bill half of this run needs a month that has not been recorded.
 * A month that has been recorded stays recorded, so a fixed short list makes the
 * check pass once and fail forever after as runs consume it. This walks a wide
 * band of past months and starts the walk at a different offset each run, so
 * consecutive runs do not queue up behind the same month.
 */
function candidateMonths(count = 36) {
  const now = new Date();
  const months = [];
  for (let back = 1; back <= count; back++) {
    const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    months.push(`${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const offset = Math.floor(Date.now() / 1000) % months.length;
  return months.slice(offset).concat(months.slice(0, offset));
}

const tally = createTally();
const { check } = tally;

async function main() {
  const page = await openPage({ port: PORT, baseUrl: BASE, label: "finance" });
  const { evaluate, goto, problems } = page;

  const setField = (selector, value) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return "missing";
      const proto = el.tagName === "SELECT" ? HTMLSelectElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      return "set";
    })()`);

  const submitForm = (label) =>
    evaluate(`(() => {
      const form = document.querySelector('form[aria-label=${JSON.stringify(label)}]');
      if (!form) return "missing";
      form.requestSubmit();
      return "submitted";
    })()`);

  const fieldValue = (label, name) =>
    evaluate(`document.querySelector('form[aria-label=${JSON.stringify(label)}] [name=${JSON.stringify(name)}]')?.value ?? null`);

  const focusedName = () =>
    evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "BODY";
      return el.name || el.getAttribute("aria-label") || el.id || el.tagName;
    })()`);

  const clickButtonWithText = (scope, text) =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(scope)})]
        .find((b) => b.textContent.trim() === ${JSON.stringify(text)});
      if (!el) return "missing";
      el.click();
      return "clicked";
    })()`);

  /** Polls an expression until it is truthy, instead of guessing a sleep. */
  async function waitFor(expression, { timeout = 20000, label = expression } = {}) {
    const deadline = Date.now() + timeout;
    for (;;) {
      if (await evaluate(expression)) return true;
      if (Date.now() > deadline) {
        console.log(`       (timed out waiting for ${label})`);
        return false;
      }
      await sleep(200);
    }
  }

  /**
   * Submits and waits for the write to finish. The wait has to catch the busy
   * state appearing as well as clearing: checking only for "not busy" returns
   * instantly, before the action has had a chance to start, and a reload then
   * drops the write. If no busy state is ever seen the action is either very
   * fast or does not use one, so a short grace period ends the wait as a pass.
   */
  async function submitAndSettle(submit, { timeout = 30000, grace = 3000 } = {}) {
    await submit();
    await sleep(120);
    const startedAt = Date.now();
    let sawBusy = false;

    for (;;) {
      const busy = await evaluate(`document.querySelectorAll('[aria-busy=true]').length`);
      if (busy > 0) sawBusy = true;
      else if (sawBusy) return true;
      else if (Date.now() - startedAt > grace) return true;

      if (Date.now() - startedAt > timeout) {
        console.log("       (the write never finished)");
        return false;
      }
      await sleep(200);
    }
  }

  /**
   * Removes anything a previous run of this check left behind. Without it a
   * second run finds two rows called "Probe bazar two", deletes one, and then
   * reports the delete as broken.
   */
  async function clearProbeRows() {
    for (let guard = 0; guard < 25; guard++) {
      // Find and click in one round trip. Counting first and clicking second
      // leaves a window where a revalidation re-renders the list and the button
      // that was counted is no longer the one there.
      const clicked = await evaluate(`(() => {
        const btn = document.querySelector('button[aria-label^="Delete Probe "]');
        if (!btn) return "none";
        btn.click();
        return "clicked";
      })()`);
      if (clicked === "none") return;

      await waitFor(`document.querySelectorAll('[role=dialog]').length === 1`, { label: "the delete confirmation" });
      await clickButtonWithText('[role=dialog] button', "Delete");
      await waitFor(`document.querySelectorAll('[role=dialog]').length === 0`, { label: "the delete to complete" });
    }
  }

  try {
    await signIn(page, { ...OWNER, baseUrl: BASE });
    check("signed in as the owner fixture", (await evaluate("location.pathname")) === "/dashboard");

    // signIn returns as soon as the path changes, which is before React has
    // painted the dashboard, so wait for the page itself before reading it.
    await goto("/dashboard", { settle: 1500, ready: `[...document.querySelectorAll("nav a")].length > 0` });
    const navLinks = await evaluate(
      `[...document.querySelectorAll('nav a')].map((a) => a.getAttribute("href"))`,
    );
    check(
      "the dashboard quick actions cover the daily jobs",
      Array.isArray(navLinks) && navLinks.includes("/meals") && navLinks.includes("/expenses") && navLinks.includes("/bills"),
      JSON.stringify(navLinks),
    );
    check("Bills is reachable from the tab bar", Array.isArray(navLinks) && navLinks.includes("/bills"));

    // ------------------------------------------------------- the inline form
    await goto("/expenses", { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an expense"]')` });
    await clearProbeRows();
    check("the add form is on the page, not behind a dialog", await evaluate(`!!document.querySelector('form[aria-label="Add an expense"]')`));
    check("nothing is open when the page loads", (await evaluate(`document.querySelectorAll('[role=dialog]').length`)) === 0);

    // Failure must not destroy the typing, and must move focus to the bad field.
    // Amount is left empty rather than filled with junk: it is type="number", so
    // the browser discards anything that is not a number and the field would
    // silently read as valid.
    await setField('form[aria-label="Add an expense"] [name=description]', "Probe invalid");
    await setField('form[aria-label="Add an expense"] [name=amount]', "");
    await submitAndSettle(() => submitForm("Add an expense"));
    const keptTyping = await fieldValue("Add an expense", "description");
    check("a rejected entry keeps what was typed", keptTyping === "Probe invalid", `description is ${JSON.stringify(keptTyping)}`);
    check("the invalid field is marked for assistive tech", await evaluate(`!!document.querySelector('form[aria-label="Add an expense"] [name=amount][aria-invalid=true]')`));
    const focusedAfterError = await focusedName();
    check("focus moved to the first invalid control", focusedAfterError === "amount", `focus is on ${focusedAfterError}`);
    check("the error is wired to the control it belongs to", await evaluate(`(() => {
      const el = document.querySelector('form[aria-label="Add an expense"] [name=amount]');
      const ids = (el?.getAttribute("aria-describedby") || "").split(/\\s+/).filter(Boolean);
      return ids.length > 0 && ids.every((id) => document.getElementById(id));
    })()`));

    // Success must clear the form and put the caret back, so the next line is
    // two fields away instead of a dialog.
    await setField('form[aria-label="Add an expense"] [name=description]', "Probe bazar one");
    await setField('form[aria-label="Add an expense"] [name=amount]', "111.50");
    await submitAndSettle(() => submitForm("Add an expense"));
    check("a saved entry clears the form", (await fieldValue("Add an expense", "description")) === "");
    check(
      "the caret returns to the description for the next line",
      (await focusedName()) === "description",
      `focus is on ${await focusedName()}`,
    );

    await setField('form[aria-label="Add an expense"] [name=description]', "Probe bazar two");
    await setField('form[aria-label="Add an expense"] [name=amount]', "222.25");
    await submitAndSettle(() => submitForm("Add an expense"));

    await goto("/expenses", { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an expense"]')` });
    const afterTwo = await evaluate(`document.body.innerText`);
    check("the first entry is on the server", afterTwo.includes("Probe bazar one") && afterTwo.includes("111.50"));
    check("two entries in a row, no dialog in between", afterTwo.includes("Probe bazar two") && afterTwo.includes("222.25"));

    // --------------------------------------------------------------- editing
    await evaluate(`document.querySelector('button[aria-label="Edit Probe bazar one"]').click()`);
    check("editing opens a dialog", await waitFor(`document.querySelectorAll('[role=dialog]').length === 1`, { label: "the edit dialog" }));
    check("the dialog is pre-filled with the stored values", await evaluate(`(() => {
      const d = document.querySelector('[role=dialog]');
      return d?.querySelector('[name=description]')?.value === "Probe bazar one";
    })()`));
    await setField('[role=dialog] [name=amount]', "150.75");
    await clickButtonWithText('[role=dialog] button', "Save changes");
    // The write landing is not the same as the dialog getting out of the way.
    // A dialog that stays open over a successful save is a real defect, and a
    // reload afterwards would hide it.
    check(
      "the edit dialog closes once the save lands",
      await waitFor(`document.querySelectorAll('[role=dialog]').length === 0`, { label: "the edit dialog to close" }),
    );
    await goto("/expenses", { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an expense"]')` });
    const edited = await evaluate(`document.body.innerText`);
    check("the edit is saved", edited.includes("150.75"), edited.includes("150.75") ? "" : "150.75 is not on the page");

    // -------------------------------------------------------------- searching
    await goto("/expenses", { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an expense"]')` });
    const typed = await setField('input[name=q]', "Probe bazar two");
    check("the search box accepts text", typed === "set", String(typed));
    await evaluate(`[...document.querySelectorAll("form")].find((f) => f.querySelector('[name=q]')).requestSubmit()`);
    check("the search navigates with the query", await waitFor(`location.search.includes("q=")`, { label: "the filtered url" }));
    /*
     * Wait for the filtered list to render rather than sleeping. The query
     * appears in the address bar as soon as the navigation commits, which is
     * before the new document has rendered, so a fixed pause here reads the
     * outgoing unfiltered list and fails for no reason.
     */
    check("the filtered result renders", await waitFor(`[...document.querySelectorAll("a")].some((a) => a.textContent.trim() === "Clear search")`, { label: "the filtered list" }));
    const searched = await evaluate(`document.body.innerText`);
    check(
      "search narrows the list",
      searched.includes("Probe bazar two") && !searched.includes("Probe bazar one"),
      `rows: ${JSON.stringify(await evaluate(`[...document.querySelectorAll('ul li p.truncate')].map((e) => e.textContent.trim())`))}`,
    );
    check("the search can be cleared from the page", await evaluate(`[...document.querySelectorAll("a")].some((a) => a.textContent.trim() === "Clear search")`));
    await evaluate(`[...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Clear search").click()`);
    check(
      "clearing the search brings the whole list back",
      await waitFor(`(document.body?.innerText ?? "").includes("Probe bazar one")`, { label: "the unfiltered list" }),
    );

    // --------------------------------------------------------------- deleting
    await goto("/expenses", { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an expense"]')` });
    await evaluate(`document.querySelector('button[aria-label="Delete Probe bazar two"]').click()`);
    check("deleting asks first", await waitFor(`document.querySelectorAll('[role=dialog]').length === 1`, { label: "the delete confirmation" }));
    await clickButtonWithText('[role=dialog] button', "Delete");
    // DeleteConfirm only closes once the action has settled, so the dialog
    // closing is the signal that the delete actually landed.
    check("the delete is confirmed and applied", await waitFor(`document.querySelectorAll('[role=dialog]').length === 0`, { label: "the delete to complete" }));
    await goto("/expenses", { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an expense"]')` });
    check("the row is gone from the server", !(await evaluate(`document.body.innerText`)).includes("Probe bazar two"));

    // ------------------------------------------------------------------ bills
    const months = candidateMonths();
    let billMonth = null;
    for (const candidate of months) {
      await goto(`/bills?month=${candidate}`, { settle: 1200, ready: `[...document.querySelectorAll("button")].some((b) => /utility bill/i.test(b.textContent))` });
      if (await evaluate(`document.body.innerText.includes("Not recorded yet")`)) {
        billMonth = candidate;
        break;
      }
    }
    check("found a month with nothing recorded to work with", billMonth !== null, `tried ${months.length} months, e.g. ${months.slice(0, 3).join(", ")}`);

    check("an unrecorded month says so", await evaluate(`document.body.innerText.includes("Not recorded yet")`));
    check("the save button does not offer to update yet", await evaluate(`[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Save utility bill")`));

    await setField('input[name=electricity]', "1250");
    await setField('input[name=gas]', "410");
    await submitAndSettle(() =>
      evaluate(`[...document.querySelectorAll("button")].find((b) => /utility bill/i.test(b.textContent)).click()`),
    );
    await goto(`/bills?month=${billMonth}`, { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an extra charge"]')` });
    const billsText = await evaluate(`document.body.innerText`);
    check("the saved month is reported as recorded", billsText.includes("Recorded"), billsText.includes("Recorded") ? "" : "no Recorded badge on the page");
    check("the button now offers an update", await evaluate(`[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Update utility bill")`));
    check("the values survived the round trip", await evaluate(`document.querySelector('input[name=electricity]')?.value === "1250" && document.querySelector('input[name=gas]')?.value === "410"`));

    // Saving the same month a second time must not blank the figures already
    // stored, which is the same reset problem seen on a rejected entry.
    await setField('input[name=water]', "");
    await submitAndSettle(() =>
      evaluate(`[...document.querySelectorAll("button")].find((b) => /utility bill/i.test(b.textContent)).click()`),
    );
    check("the recorded month is still there after another save", await evaluate(`document.querySelector('input[name=electricity]')?.value === "1250"`));

    // ------------------------------------------------------- extra charges
    await clearProbeRows();
    check("the extra charge form is inline", await evaluate(`!!document.querySelector('form[aria-label="Add an extra charge"]')`));
    await setField('form[aria-label="Add an extra charge"] [name=title]', "Probe cook");
    await setField('form[aria-label="Add an extra charge"] [name=amount]', "3000");
    await submitAndSettle(() => submitForm("Add an extra charge"));
    check("the extra charge form clears itself", (await fieldValue("Add an extra charge", "title")) === "");
    check("the extra charge is listed", (await evaluate(`document.body.innerText`)).includes("Probe cook"));

    await evaluate(`document.querySelector('button[aria-label="Edit Probe cook"]').click()`);
    check("editing an extra charge opens a dialog", await waitFor(`document.querySelectorAll('[role=dialog]').length === 1`, { label: "the extra charge dialog" }));
    check("the extra charge dialog is pre-filled", await evaluate(`(() => {
      const d = document.querySelector('[role=dialog]');
      return d?.querySelector('[name=title]')?.value === "Probe cook" && d?.querySelector('[name=amount]')?.value === "3000";
    })()`));
    await setField('[role=dialog] [name=amount]', "3200");
    await clickButtonWithText('[role=dialog] button', "Save changes");
    check(
      "the extra charge dialog closes once the save lands",
      await waitFor(`document.querySelectorAll('[role=dialog]').length === 0`, { label: "the extra charge dialog to close" }),
    );
    await goto(`/bills?month=${billMonth}`, { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an extra charge"]')` });
    const afterEdit = await evaluate(`document.body.innerText`);
    check("the extra charge edit is saved", afterEdit.includes("3,200") || afterEdit.includes("3200"), afterEdit.includes("3,200") ? "" : "3,200 is not on the page");

    await evaluate(`document.querySelector('button[aria-label="Delete Probe cook"]').click()`);
    await waitFor(`document.querySelectorAll('[role=dialog]').length === 1`, { label: "the delete confirmation" });
    await clickButtonWithText('[role=dialog] button', "Delete");
    await waitFor(`document.querySelectorAll('[role=dialog]').length === 0`, { label: "the delete to complete" });
    await goto(`/bills?month=${billMonth}`, { settle: 1500, ready: `!!document.querySelector('form[aria-label="Add an extra charge"]')` });
    check("the extra charge is removed", !(await evaluate(`document.body.innerText`)).includes("Probe cook"));

    check("no exceptions or 5xx while driving all of this", problems.length === 0, problems.slice(0, 2).join(" | "));
  } finally {
    page.close();
  }
}

console.log("expenses and bills through a real browser");
await main();

report(tally);
