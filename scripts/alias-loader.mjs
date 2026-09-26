import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

/**
 * Lets the Node test scripts import app modules written for the bundler, which
 * resolves the `@/` alias and extensionless specifiers. Node needs both handled
 * explicitly, so this mirrors what `jsconfig.json` does inside Next.
 */
export function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  const base = path.join(root, "src", specifier.slice(2));

  for (const candidate of [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return next(pathToFileURL(candidate).href, context);
    }
  }

  return next(pathToFileURL(base).href, context);
}
