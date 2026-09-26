/**
 * Placeholder for owner-page navigation. It renders inside the app shell, so
 * the sidebar stays put and only the content area is replaced — a full-screen
 * spinner here would make the whole app appear to reload.
 */
export default function AppLoading() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="Loading">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded-[var(--radius-field)] bg-surface-muted" />
          <div className="h-3.5 w-48 animate-pulse rounded-[var(--radius-field)] bg-surface-muted" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-[var(--radius-field)] bg-surface-muted" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted/60"
          />
        ))}
      </div>

      <div className="h-64 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted/40" />

      <span className="sr-only">Loading…</span>
    </div>
  );
}
