import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface shadow-soft",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, as: Tag = "h2", ...props }) {
  return <Tag className={cn("text-[15px] font-semibold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-[13px] text-muted-foreground", className)} {...props} />;
}

/** Body area. `padded={false}` is for tables that manage their own spacing. */
export function CardContent({ className, padded = true, ...props }) {
  return <div className={cn(padded && "p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border bg-surface-muted/50 px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

/** Small stat tile used across the dashboard and settings. */
export function StatCard({ icon: Icon, label, value, hint, tone = "default", className }) {
  const tones = {
    default: "bg-surface-muted text-foreground",
    primary: "bg-primary-subtle text-primary",
    success: "bg-success-subtle text-success",
    warning: "bg-warning-subtle text-warning",
    danger: "bg-danger-subtle text-danger",
    info: "bg-info-subtle text-info",
  };

  return (
    <Card className={cn("print-card overflow-hidden", className)}>
      <div className="flex items-start gap-3.5 p-4">
        {Icon ? (
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone] ?? tones.default)}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-muted-foreground">{label}</p>
          <p className="nums mt-0.5 truncate text-xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </Card>
  );
}
