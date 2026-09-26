"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "messmate-theme";
const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function applyTheme(theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/*
 * The stored preference is treated as an external store rather than copied into
 * React state with an effect. `useSyncExternalStore` reads it during render, so
 * the button is already correct on first paint and there is no setState-in-
 * effect cascade.
 */

const listeners = new Set();

function subscribe(onChange) {
  listeners.add(onChange);
  // Fires when another tab changes the preference.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? "system";
}

function getServerSnapshot() {
  return "system";
}

/** True only after hydration, so server and client markup match. */
const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

export function ThemeToggle({ className }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();

  function cycle() {
    const current = getSnapshot();
    const index = OPTIONS.findIndex((option) => option.value === current);
    const next = OPTIONS[(index + 1) % OPTIONS.length].value;

    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    listeners.forEach((listener) => listener());
  }

  const Active = OPTIONS.find((option) => option.value === theme)?.icon ?? Monitor;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={cycle}
      className={className}
      title={hydrated ? `Theme: ${theme}` : "Theme"}
      aria-label={hydrated ? `Theme: ${theme}. Click to change.` : "Change theme"}
    >
      <Active className="size-4" aria-hidden />
    </Button>
  );
}

/**
 * Runs before first paint to set the theme class, preventing the white flash
 * that a dark-mode user would otherwise get on every load.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})();`;
