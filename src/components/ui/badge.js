import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-surface-muted text-muted-foreground border-border",
  primary: "bg-primary-subtle text-primary border-primary-border",
  success: "bg-success-subtle text-success border-success/25",
  warning: "bg-warning-subtle text-warning border-warning/25",
  danger: "bg-danger-subtle text-danger border-danger/25",
  info: "bg-info-subtle text-info border-info/25",
};

export function Badge({ className, tone = "neutral", dot = false, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
        TONES[tone] ?? TONES.neutral,
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
