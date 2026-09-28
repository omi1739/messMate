import { requireMessOwner } from "@/lib/dal";
import { AppShell } from "@/components/app-shell";

/**
 * Every owner page lives under this layout, so the session and mess scope are
 * checked exactly once per navigation.
 *
 * The name and mess name come from `requireMessOwner`, which re-reads the account
 * rather than trusting the cookie. The JWT is minted at sign-in, so taking them
 * from the token meant a profile or mess rename kept showing the old value in the
 * sidebar until the owner signed in again.
 */
export default async function AppLayout({ children }) {
  const user = await requireMessOwner();

  return <AppShell user={user}>{children}</AppShell>;
}
