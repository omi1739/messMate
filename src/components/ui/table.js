import { cn } from "@/lib/utils";

/**
 * Table primitives with horizontal scroll handled by the wrapper, so a wide
 * report is usable on a phone instead of forcing the page to scroll sideways.
 */
export function TableWrap({ className, children, ...props }) {
  return (
    <div className={cn("w-full overflow-x-auto scrollbar-thin", className)} {...props}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return (
    <thead
      className={cn("border-b border-border bg-surface-muted/70 text-[12px] uppercase tracking-wide", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableFoot({ className, ...props }) {
  return (
    <tfoot className={cn("border-t-2 border-border-strong bg-surface-muted/70 font-medium", className)} {...props} />
  );
}

export function TableRow({ className, ...props }) {
  return <tr className={cn("transition-colors hover:bg-surface-muted/60", className)} {...props} />;
}

export function TableHeadCell({ className, align = "left", ...props }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 font-semibold text-muted-foreground first:pl-4 last:pr-4",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, align = "left", numeric = false, ...props }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle first:pl-4 last:pr-4",
        numeric && "nums text-right",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}
