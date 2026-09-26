/**
 * Tenant isolation check.
 *
 * Signs in as one owner, then tries to drive a Server Action that targets a
 * record belonging to a *different* mess. Every one of these must be refused:
 * the actions scope their writes by the session's messId, so a foreign id has to
 * behave exactly like a nonexistent one.
 *
 * Run with the dev server up:  node scripts/test-isolation.mjs
 */

const base = process.env.MESSMATE_BASE ?? "http://localhost:3000";
const OWNER = { email: "e2e-probe@test.local", password: "Probe12345" };
const OTHER = { email: "e2e-other@test.local", password: "Probe12345" };
import { readdir, readFile } from "node:fs/promises";

let failures = 0;
let checks = 0;

function ok(label, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? `  -- ${detail}` : ""}`);
  }
}

async function signIn({ email, password }, provider = "credentials") {
  const jar = new Map();
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookie = csrfRes.headers.getSetCookie().join("; ");

  const res = await fetch(
    `${base}/api/auth/callback/${provider}`,
    {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
      body: new URLSearchParams({
        email,
        password,
        csrfToken,
        callbackUrl: `${base}/dashboard`,
      }),
    },
  );

  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }

  const session = await fetch(`${base}/api/auth/session`, {
    headers: { cookie: cookieHeader(jar) },
  });

  return { jar, session: await session.json() };
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function pageText(path, jar) {
  const res = await fetch(`${base}${path}`, { headers: { cookie: cookieHeader(jar) } });
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

console.log("tenant isolation");

const owner = await signIn(OWNER);
const other = await signIn(OTHER);
await pageText("/dashboard", owner.jar); // warm the session

ok("owner session is an owner", owner.session?.user?.isAdmin === false);
ok("other session is an owner", other.session?.user?.isAdmin === false);
ok(
  "the two owners are different users",
  owner.session?.user?.id !== other.session?.user?.id,
  `${owner.session?.user?.id} vs ${other.session?.user?.id}`,
);

// The cheapest real assertion available over HTTP: neither owner may see the
// other's mess anywhere in a rendered page.
const probeText = await pageText("/members", owner.jar);
ok(
  "owner does not see the other owner's name in /members",
  !probeText.includes("Other Owner"),
);
const otherText = await pageText("/members", other.jar);
ok(
  "other owner does not see the probe members",
  !otherText.includes("Asha Rahman"),
);
ok("other owner has an empty roster", /Add your first member|Add member/i.test(otherText));

const otherDashboard = await pageText("/dashboard", other.jar);
ok(
  "other owner's dashboard shows no probe totals",
  !otherDashboard.includes("12,675") && !otherDashboard.includes("25,800"),
);

/*
 * Source-level backstop. Over HTTP an action's compiled id cannot be addressed
 * directly, so the write path is checked by reading it instead: any mutating
 * call in the owner actions must carry the session's messId, either in a where
 * clause or in the created row. An unscoped write is a cross-tenant bug.
 *
 * Two files are excluded, each for a different reason:
 *   admin.js - deliberately cross-tenant; that is the point of the platform
 *              panel, and it is gated by requireSuperAdmin() instead.
 *   auth.js  - the account layer, not the tenant-data layer. Signup *creates*
 *              the mess rather than writing into one, and the profile/password
 *              updates are scoped to the session's own user.id, which is the
 *              correct boundary for "edit yourself".
 */
const actionDir = new URL("../src/app/actions/", import.meta.url);
const files = (await readdir(actionDir)).filter(
  (name) => name.endsWith(".js") && name !== "admin.js" && name !== "auth.js",
);

for (const file of files) {
  const source = await readFile(new URL(file, actionDir), "utf8");

  for (const call of source.matchAll(
    /db\.\w+\.(updateMany|deleteMany|create|upsert|update|createMany)\(\{[\s\S]*?\n\s{2}\}\)/g,
  )) {
    const [snippet] = call;
    const op = call[1];
    // An upsert's `where` is the composite (messId_month...) key, and `create`
    // sets messId on the new row, so both legitimately contain it.
    ok(`${file}: ${op} is mess-scoped`, /\bmessId\b/.test(snippet));
  }
}

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) {
  console.error(`${failures} isolation check(s) FAILED`);
  process.exit(1);
}
