import { cn } from "@/lib/utils";

/**
 * Button styling as plain class names.
 *
 * `Button` is a client component, but the marketing pages and the server-
 * rendered layout are not, and they still need button-styled links. Keeping the
 * map here means there is exactly one definition of what a primary button
 * looks like, and `<Button>` just consumes it.
 */

const VARIANTS = {
  primary:
    "bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover active:translate-y-px",
  secondary:
    "bg-surface-muted text-foreground border border-border hover:bg-faint/60 active:translate-y-px",
  outline:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-muted active:translate-y-px",
  ghost: "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
  danger: "bg-danger text-danger-foreground shadow-soft hover:opacity-90 active:translate-y-px",
  success: "bg-success text-success-foreground shadow-soft hover:opacity-90 active:translate-y-px",
  link: "text-primary underline-offset-4 hover:underline",
};

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  default: "h-9.5 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-6 text-[15px]",
  icon: "h-9.5 w-9.5 px-0",
  "icon-sm": "h-8 w-8 px-0",
};

export const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-field)] font-medium " +
  "transition-[background-color,color,box-shadow,transform,opacity] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-55 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function buttonClass({ variant = "primary", size = "default", className } = {}) {
  return cn(BUTTON_BASE, VARIANTS[variant] ?? VARIANTS.primary, SIZES[size] ?? SIZES.default, className);
}
