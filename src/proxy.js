import { NextResponse } from "next/server";
import { auth } from "@/auth";

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

function isPublic(path) {
  return PUBLIC_PATHS.has(path);
}

export default auth((request) => {
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

  if (!isLoggedIn && !isPublic(path)) {
    const target = new URL("/login", nextUrl);
    if (path !== "/") target.searchParams.set("next", path);
    return NextResponse.redirect(target);
  }

  // Already signed in: the landing page and the auth forms are pointless.
  if (isLoggedIn && isPublic(path)) {
    return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except API routes, Next internals and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
