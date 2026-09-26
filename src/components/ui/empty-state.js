import { cn } from "@/lib/utils";

/**
 * Empty state. Every list in the app renders one of these instead of a blank
 * area, and it always offers the next action rather than just explaining the
 * absence.
 */
export function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      {Icon ? (
        <span className="grid size-11 place-items-center rounded-2xl bg-surface-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className={cn("font-semibold", compact ? "text-sm" : "text-[15px]")}>{title}</p>
        {description ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
