import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * The theme is a string, a class toggle and a pre-paint script, so there is
 * nothing here to import: what matters is that the three places that decide the
 * theme agree on light, and that "system" still works for anyone who picks it.
 * These are read from the source on purpose, because the failure mode is the
 * three drifting apart rather than any one of them being wrong.
 */

const source = readFileSync(
  fileURLToPath(new URL("../src/components/theme-toggle.js", import.meta.url)),
  "utf8",
);

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.log(`  FAIL ${name}\n       ${error.message}`);
    process.exitCode = 1;
  }
}

console.log("theme default");

test("light is the declared default", () => {
  assert.match(source, /const DEFAULT_THEME = "light"/);
});

test("a visitor with no stored preference reads as light", () => {
  assert.match(
    source,
    /getSnapshot[\s\S]*?localStorage\.getItem\(STORAGE_KEY\) \?\? DEFAULT_THEME/,
  );
});

test("the server snapshot is light, so the first paint cannot disagree", () => {
  const fn = source.slice(source.indexOf("function getServerSnapshot"));
  assert.match(fn.slice(0, fn.indexOf("}")), /return DEFAULT_THEME/);
});

test("the pre-paint script falls back to light", () => {
  const script = source.slice(source.indexOf("export const themeScript"));
  assert.match(
    script,
    /localStorage\.getItem\("\$\{STORAGE_KEY\}"\)\|\|"\$\{DEFAULT_THEME\}"/,
  );
});

test("the OS preference still decides the explicit system option", () => {
  assert.match(source, /t==="system"&&matchMedia\("\(prefers-color-scheme: dark\)"\)\.matches/);
});

test("light is the first stop in the toggle cycle", () => {
  const opts = source.slice(source.indexOf("const OPTIONS"), source.indexOf("];", source.indexOf("const OPTIONS")));
  assert.ok(
    opts.indexOf('"light"') < opts.indexOf('"dark"'),
    "a first-time visitor clicking the button should get dark, not system",
  );
});

test("nothing still falls back to the old system default", () => {
  assert.ok(
    !/localStorage\.getItem\(STORAGE_KEY\)\s*\?\?\s*"system"/.test(source),
    "getSnapshot must not default to system again",
  );
  assert.ok(
    !/\|\|"system"/.test(source),
    "the pre-paint script must not fall back to system",
  );
});

console.log(`\n${passed} passed, ${process.exitCode ? "some failed" : "all green"}`);
