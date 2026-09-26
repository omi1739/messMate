import { revalidatePath } from "next/cache";
import { assertSameOrigin, requireMessId } from "@/lib/dal";

/**
 * Server-only action gates.
 *
 * Server Actions are public POST endpoints — anyone holding a session cookie
 * can invoke one directly, bypassing the UI. So every action runs the same two
 * checks first: the request must be same-origin, and there must be a valid
 * mess scope to act within.
 */

/** Gates an action, returning the mess scope it may write to. */
export async function guardAction() {
  await assertSameOrigin();
  return { messId: await requireMessId() };
}

/**
 * Every app page is derived from the same monthly settlement, so a change in
 * one place (a single bazar entry, say) moves numbers on all of them. Revoking
 * them together keeps the UI from ever showing a stale total.
 */
const APP_PATHS = ["/dashboard", "/members", "/meals", "/expenses", "/bills", "/reports", "/settings"];

export function revalidateApp(...extraPaths) {
  for (const path of new Set([...APP_PATHS, ...extraPaths])) {
    revalidatePath(path);
  }
}
