export default function Loading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="sr-only">Loading…</span>
      <div className="flex items-center gap-2.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-2 animate-pulse rounded-full bg-primary/50"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
