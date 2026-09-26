import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} {...props} />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-border bg-surface p-4", className)}>
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn("h-8 flex-1", c === 0 && "max-w-[40%]")} />
          ))}
        </div>
      ))}
    </div>
  );
}
