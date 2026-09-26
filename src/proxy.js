import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { describeRequest, recordVisit } from "@/lib/analytics";

/**
 * Optimistic route protection.
 *
 * In Next.js 16 the old `middleware.ts` is called `proxy.ts`. This runs on
 * every request but is deliberately cheap: it only decrypts the session JWT —
 * no database access — to bounce people out of pages they cannot use.
 *
 * This is NOT the security boundary. Every Server Action and query re-checks
 * the session and the mess scope through `src/lib/dal.js`. Proxy just avoids
 * flashing the wrong page to the wrong person.
 */

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/admin-login"]);

/**
 * The owner app, matched on the first segment so "/members/123" is covered too.
 *
 * This list is what keeps the sign-in redirect pointed at real pages. Anything
 * NOT listed here is an unknown URL and must be left alone so Next can render
 * the app-wide 404 — a blanket "redirect everything unlisted" rule sends every
 * mistyped link to the login form and hides 404s from crawlers.
 */
const OWNER_SEGMENTS = new Set([
  "dashboard",
  "members",
  "meals",
  "expenses",
  "bills",
  "reports",
  "settings",
]);

function isPublic(path) {
  return PUBLIC_PATHS.has(path);
}

function isOwnerArea(path) {
  return OWNER_SEGMENTS.has(path.split("/")[1] ?? "");
}

/**
 * Hands a request to the traffic recorder without holding up the response.
 *
 * The write goes to MongoDB, so it must not sit between the visitor and the
 * page. `waitUntil` lets the server finish the response and keep working in the
 * background, which is what stops the database write from being cut short when
 * the process would otherwise be frozen.
 */
function countVisit(request, event) {
  let visit;
  try {
    visit = describeRequest(request);
  } catch {
    return; // never let analytics break routing
  }
  if (!visit) return;

  const work = recordVisit(visit);
  if (typeof event?.waitUntil === "function") {
    event.waitUntil(work);
  } else {
    void work;
  }
}

export default auth((request, event) => {
  const { nextUrl } = request;
  const path = nextUrl.pathname;
  const user = request.auth?.user;
  const isLoggedIn = Boolean(user);
  const isAdmin = Boolean(user?.isAdmin);

  // /admin/* is super-admin only. Checked by exact segment so that
  // "/admin-login" is not swallowed by a naive startsWith("/admin").
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");

  if (isAdminArea && !isAdmin) {
    return NextResponse.redirect(new URL("/admin-login", nextUrl));
  }

  if (path === "/admin-login" && isAdmin) {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  // Signed-out visitors get the login form for the app's real pages only.
  if (!isLoggedIn && isOwnerArea(path)) {
    const target = new URL("/login", nextUrl);
    target.searchParams.set("next", path);
    return NextResponse.redirect(target);
  }

  // A super admin has no mess, so they have nothing to do inside the owner app.
  if (isAdmin && isOwnerArea(path)) {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  // Already signed in: the landing page and the auth forms are pointless.
  if (isLoggedIn && isPublic(path)) {
    return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/dashboard", nextUrl));
  }

  // Counted only once the page is genuinely going to render. A signed-out
  // visitor bouncing off /dashboard to /login has not viewed /dashboard, and
  // counting the bounce would make every protected page look busy.
  countVisit(request, event);

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except API routes, Next internals and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
