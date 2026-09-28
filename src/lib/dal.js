import { auth } from "@/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";

/**
 * Data Access Layer
 * =================
 *
 * Every read and every mutation in this app goes through this module so that
 * two invariants are impossible to forget:
 *
 *   1. There is always an authenticated session before data is touched.
 *   2. Data is always scoped to that session's `messId`, so one account can
 *      never observe or modify another mess's records.
 *
 * `proxy.js` also guards routes, but that is an optimistic cookie check only —
 * it is explicitly NOT treated as the security boundary. The checks here are.
 */

/**
 * Signed-in user, or null. Memoised per request/render pass.
 *
 * A JWT cannot be revoked: once minted it stays valid until it expires, and the
 * session strategy is JWT. Reading the claims alone would mean a session created
 * before a suspension — or before the account was deleted — kept working for the
 * full 30 days, with a deleted user's cookie still satisfying every guard while
 * the mess behind it no longer exists. So the account row is re-read here: one
 * primary-key lookup per request, and a session the database no longer endorses
 * resolves to `null` exactly like never having signed in.
 *
 * This is also the only place `name` and `messId` can be fresh. The token holds
 * whatever they were at sign-in, so a profile rename or a mess rename would
 * otherwise not reach the sidebar until the user signed out and back in.
 */
export const getCurrentUser = cache(async () => {
  const sessionUser = (await auth())?.user;
  if (!sessionUser?.id) return null;

  // The super admin has no account row on purpose: their credentials live in
  // the environment and are never stored, so there is nothing to re-read.
  if (sessionUser.isAdmin) {
    return { ...sessionUser, deleted: false, suspended: false };
  }

  const account = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      suspended: true,
      mess: { select: { id: true, name: true } },
    },
  });

  if (!account || account.suspended) return null;

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    isAdmin: false,
    messId: account.mess?.id ?? null,
    messName: account.mess?.name ?? null,
    deleted: false,
    suspended: false,
  };
});

/** Signed-in user for a page; redirects to /login when absent. */
async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Signed-in mess owner for a page. Redirects to the right place depending on
 * who is asking: anonymous -> /login, super admin -> /admin (an admin has no
 * mess and therefore nothing to do in the tenant app).
 */
export async function requireMessOwner() {
  const user = await requireUser();
  if (user.isAdmin) redirect("/admin");
  if (!user.messId) redirect("/login?error=MissingMess");
  return user;
}

/** Super admin for a page. Redirects to /admin-login for anyone else. */
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/admin-login");
  return user;
}

/**
 * The tenant scope for a request. Refuses to hand out `null` so a missing scope
 * can never be mistaken for "see everything". A missing scope is an orphaned
 * session, and it gets the same designed outcome as `requireMessOwner` — a
 * redirect — rather than a thrown `Error` that surfaces as a 500 from every
 * action and leaves the user signed in with no way back to the login form.
 */
export async function requireMessId() {
  const user = await requireUser();
  if (!user.messId) redirect("/login?error=MissingMess");
  return user.messId;
}

/**
 * The mess id the *current* form submission came from. Server Actions are
 * POST endpoints reachable by anyone holding a valid session cookie, so the
 * origin is checked explicitly instead of trusting the hidden field.
 */
export async function assertSameOrigin() {
  const requestHeaders = await headers();

  // Behind a reverse proxy the browser used the public host, while the Node
  // process may have received the proxy's own. Comparing against `host` alone
  // rejected every action in the app on a default nginx config, and no
  // configuration could fix it.
  const expectedHost = (
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? ""
  )
    .split(",")[0]
    .trim();

  // `Origin` is sent on every browser form POST. `Referer` is the fallback for
  // the clients that omit it, and is stripped more often, so it is only used
  // when `Origin` is absent.
  const source = requestHeaders.get("origin") ?? requestHeaders.get("referer");

  if (!source) {
    // No browser was involved. CSRF needs a victim's browser to attach the
    // session cookie, and the session cookie is `SameSite=Lax` besides, so a
    // request with neither header is a direct client (curl, the test scripts)
    // that presented its own cookie on purpose — there is nothing to forge.
    return;
  }

  if (!expectedHost) {
    throw new Error("Cross-origin form submission rejected");
  }

  let sourceHost;
  try {
    sourceHost = new URL(source).host;
  } catch {
    // A malformed value is a mismatch, not an absence.
    throw new Error("Cross-origin form submission rejected");
  }

  if (sourceHost !== expectedHost) {
    throw new Error("Cross-origin form submission rejected");
  }
}
