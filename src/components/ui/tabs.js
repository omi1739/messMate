"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tab strip. Implemented as real buttons with `role="tab"` so arrow-key
 * navigation and screen-reader grouping work without a router round trip.
 */
export function Tabs({ tabs, value, onChange, className, children }) {
  const baseId = useId();

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Views"
        className="inline-flex items-center gap-1 overflow-x-auto rounded-[var(--radius-field)] bg-surface-muted p-1 scrollbar-thin"
      >
        {tabs.map((tab) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${baseId}-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-${tab.value}-panel`}
              onClick={() => onChange(tab.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                selected
                  ? "bg-surface text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.icon ? <tab.icon className="size-3.5" aria-hidden /> : null}
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={cn(
                    "nums rounded-full px-1.5 text-[11px]",
                    selected ? "bg-primary-subtle text-primary" : "bg-faint text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-${value}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-${value}`}
        className="mt-4"
      >
        {children}
      </div>
    </div>
  );
}

/** Uncontrolled convenience wrapper. */
export function TabsGroup({ tabs, defaultValue, children }) {
  const [value, setValue] = useState(defaultValue ?? tabs[0]?.value);
  return (
    <Tabs tabs={tabs} value={value} onChange={setValue}>
      {typeof children === "function" ? children(value) : children}
    </Tabs>
  );
}
