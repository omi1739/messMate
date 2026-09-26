import { cn } from "@/lib/utils";

/** Wordmark + glyph. `href` makes it a link; omit it for a static lockup. */
export function Brand({ href, className, size = "default", showText = true, subtitle }) {
  const glyphSize = size === "sm" ? "size-7" : "size-8.5";

  const content = (
    <>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft",
          glyphSize,
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-[58%]" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 11h17" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M4 18.5h16" />
          <path d="M12 7.2c0-1.2 1-1.6 1-2.6" />
          <path d="M9 7.6c0-1 .8-1.3.8-2.2" />
        </svg>
      </span>

      {showText ? (
        <span className="min-w-0 leading-tight">
          <span className={cn("block font-semibold tracking-tight", size === "sm" ? "text-sm" : "text-[15px]")}>
            MessMate
          </span>
          {subtitle ? (
            <span className="block truncate text-[11.5px] text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  const classes = cn("inline-flex items-center gap-2.5", className);

  if (!href) return <span className={classes}>{content}</span>;

  return (
    <a href={href} className={cn(classes, "rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4")}>
      {content}
    </a>
  );
}
