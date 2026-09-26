import { auth } from "@/auth";
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

/** Signed-in user, or null. Memoised per request/render pass. */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

/** Signed-in user for a page; redirects to /login when absent. */
export async function requireUser() {
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
 * can never be mistaken for "see everything".
 */
export async function requireMessId() {
  const user = await requireUser();
  if (!user.messId) {
    throw new Error("No mess scope for this session");
  }
  return user.messId;
}

/** True when the incoming request came from a signed-in session. */
export async function isAuthenticated() {
  return Boolean(await getCurrentUser());
}

export async function isSuperAdmin() {
  const user = await getCurrentUser();
  return Boolean(user?.isAdmin);
}

/**
 * The mess id the *current* form submission came from. Server Actions are
 * POST endpoints reachable by anyone holding a valid session cookie, so the
 * origin is checked explicitly instead of trusting the hidden field.
 */
export async function assertSameOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (!origin || !host) return;
  try {
    if (new URL(origin).host !== host) {
      throw new Error("Cross-origin form submission rejected");
    }
  } catch {
    throw new Error("Cross-origin form submission rejected");
  }
}
