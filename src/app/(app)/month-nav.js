import { currentMonthKey, isMonthKey, monthLabel, shiftMonth } from "@/lib/date";
import { buttonClass } from "@/components/ui/button-classes";
import Link from "next/link";

/**
 * Month switcher shared by every page that scopes data to a month.
 *
 * A plain link, not a client component: navigation is a server round trip, which
 * keeps the URL the single source of truth for "which month am I looking at".
 */
export function MonthNav({ month, basePath, className }) {
  const current = isMonthKey(month) ? month : currentMonthKey();
  const previous = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);
  const isCurrentMonth = current === currentMonthKey();

  function hrefFor(key) {
    const query = key === currentMonthKey() ? "" : `?month=${key}`;
    return `${basePath}${query}`;
  }

  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1 rounded-[var(--radius-field)] border border-border bg-surface p-0.5">
        <MonthLink href={hrefFor(previous)} label="Previous month">
          <span aria-hidden>&larr;</span>
        </MonthLink>

        <span className="min-w-[8.5rem] px-2 text-center text-[13.5px] font-semibold">
          {monthLabel(current, { short: false })}
        </span>

        <MonthLink href={hrefFor(next)} label="Next month">
          <span aria-hidden>&rarr;</span>
        </MonthLink>

        {!isCurrentMonth ? (
          <Link
            href={`${basePath}`}
            className={buttonClass({ variant: "ghost", size: "sm", className: "ml-0.5" })}
          >
            This month
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function MonthLink({ href, label, children }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[15px] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}
