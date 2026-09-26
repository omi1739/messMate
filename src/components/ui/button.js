import * as React from "react";
import { cn } from "@/lib/utils";

export const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        {
          "bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-500/10": variant === "default",
          "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/10": variant === "success",
          "bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-500/10": variant === "destructive",
          "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 dark:text-slate-300": variant === "outline",
          "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300": variant === "ghost",
          "text-violet-600 hover:underline dark:text-violet-400": variant === "link",
        },
        {
          "h-10 px-4 py-2": size === "default",
          "h-9 rounded-md px-3": size === "sm",
          "h-11 rounded-lg px-8": size === "lg",
          "h-10 w-10": size === "icon",
        },
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = "Button";
