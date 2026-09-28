"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tab strip. Implemented as real buttons with `role="tab"` and a roving
 * tabindex, so the WAI-ARIA tabs keyboard contract actually holds: Left/Right
 * (and Home/End) move between tabs, and Tab moves *out* of the strip to the
 * panel rather than through every tab. All of it client-side, so switching a
 * view never costs a router round trip.
 */
export function Tabs({ tabs, value, onChange, className, children }) {
  const baseId = useId();
  const listRef = useRef(null);

  function moveFocus(from, delta) {
    if (tabs.length === 0) return;
    const next = (from + delta + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    // The button for the newly selected tab is the only one in the tab order, so
    // focus has to be moved explicitly or it stays parked on the old tab.
    listRef.current?.querySelector(`#${CSS.escape(`${baseId}-${tabs[next].value}`)}`)?.focus();
  }

  function onKeyDown(event) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveFocus(tabs.findIndex((tab) => tab.value === value), 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveFocus(tabs.findIndex((tab) => tab.value === value), -1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(0, 0);
        break;
      case "End":
        event.preventDefault();
        moveFocus(tabs.length - 1, 0);
        break;
      default:
    }
  }

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Views"
        onKeyDown={onKeyDown}
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
              // Roving tabindex: only the selected tab is reachable with Tab, which
              // is what keeps the arrow keys meaningful.
              tabIndex={selected ? 0 : -1}
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
