import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Minimal test runner so `npm test` works the same on Windows and Unix without
 * relying on shell glob expansion. Every `scripts/test-*.mjs` file is imported
 * for its side effects; a non-zero `process.exitCode` fails the run.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs
  .readdirSync(here)
  .filter((name) => name.startsWith("test-") && name.endsWith(".mjs"))
  .sort();

if (files.length === 0) {
  console.error("No test files found in scripts/.");
  process.exit(1);
}

console.log(`running ${files.length} test file(s): ${files.join(", ")}\n`);

for (const file of files) {
  console.log(`── ${file} ${"─".repeat(Math.max(0, 58 - file.length))}`);
  await import(pathToFileURL(path.join(here, file)).href);
  console.log("");
}

if (process.exitCode) {
  console.error("FAILED");
} else {
  console.log("All test files passed.");
}
