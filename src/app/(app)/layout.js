import { requireMessOwner } from "@/lib/dal";
import { getMessProfile } from "@/lib/data/mess";
import { AppShell } from "@/components/app-shell";

/**
 * Every owner page lives under this layout, so the session and mess scope are
 * checked exactly once per navigation.
 *
 * The mess name is read fresh from the database rather than taken from the
 * session cookie: the JWT is minted at sign-in, so a rename would otherwise
 * keep showing the old name in the sidebar until the owner signed in again.
 */
export default async function AppLayout({ children }) {
  const user = await requireMessOwner();
  const mess = await getMessProfile();

  return (
    <AppShell user={{ ...user, messName: mess?.name ?? user.messName }}>
      {children}
    </AppShell>
  );
}
