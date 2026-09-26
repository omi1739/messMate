import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small rounded label. Shared by the account rows and the panels. */
export function Tag({ tone = "default", children, className }) {
  const tones = {
    default: "bg-surface-muted text-muted-foreground",
    primary: "bg-primary-subtle text-primary",
    success: "bg-success-subtle text-success",
    warning: "bg-warning-subtle text-warning",
    danger: "bg-danger-subtle text-danger",
    info: "bg-info-subtle text-info",
  };

  return (
    <span
      className={cn(
        "inline-block rounded-full px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * How much a mess has actually recorded. The point is to separate a real user
 * from a signup that was abandoned on day one, which the account list alone
 * cannot show.
 */
export function UsageTag({ usage }) {
  const map = {
    active: { tone: "success", label: "active" },
    light: { tone: "info", label: "light use" },
    empty: { tone: "warning", label: "never used" },
  };
  const entry = map[usage] ?? map.empty;
  return <Tag tone={entry.tone}>{entry.label}</Tag>;
}

/**
 * Week-on-week change. Deliberately plain about the two cases where a
 * percentage is meaningless: no previous activity, or nothing to compare yet.
 */
export function Delta({ current, previous, unit = "" }) {
  if (!previous) {
    return (
      <span className="text-[12px] text-muted-foreground">
        {current > 0 ? "no prior week to compare" : "no change"}
      </span>
    );
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
        <Minus className="size-3.5" aria-hidden />
        level with last week
      </span>
    );
  }
  const up = rounded > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[12px] font-medium",
        up ? "text-success" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}
      {rounded}%
      <span className="font-normal text-muted-foreground">
        {unit} vs last week
      </span>
    </span>
  );
}

/** A compact figure-and-caption block for the top of a panel. */
export function Metric({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[12.5px] font-medium text-muted-foreground">{label}</p>
      <p className="nums mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <div className="mt-0.5">{hint}</div> : null}
    </div>
  );
}
