/**
 * Shared shapes and pure helpers for Server Action state.
 *
 * IMPORTANT: this module is imported by client components too, so it must never
 * pull in Prisma, next-auth, or next/cache. Server-only gating lives in
 * `src/lib/action-guard.js` instead.
 */

import { fieldErrors } from "@/lib/validators";

/**
 * Consistent result shape for `useActionState`. Both helpers return the same
 * keys so a consumer can read `.message` and `.error` without first checking
 * which helper produced the value.
 */
export function fail(message, errors) {
  return { ok: false, message: null, error: message ?? null, errors: errors ?? null };
}

export function succeed(message) {
  return { ok: true, message: message ?? null, error: null, errors: null };
}

export function formString(formData, key) {
  const value = formData?.get(key);
  return typeof value === "string" ? value : "";
}

/** Read a checkbox out of FormData (absent === false). */
/**
 * Keeps post-sign-in redirects on this origin. Without this, `?next=` in the
 * login form would be an open redirect straight off-site.
 */
export function safeNextPath(value, fallback = "/dashboard") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

export { fieldErrors };
