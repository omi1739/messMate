"use client";

import { useEffect, useState } from "react";
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

export function ThemeToggle({ className }) {
  const [theme, setTheme] = useState("system");
  const [mounted, setMounted] = useState(false);

  // Read the stored preference after mount; the inline script in the layout has
  // already applied the class, so there is no flash.
  useEffect(() => {
    setTheme(window.localStorage.getItem(STORAGE_KEY) ?? "system");
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== "system") return;
    // Follow the OS while "system" is selected.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, mounted]);

  function cycle() {
    setTheme((current) => {
      const index = OPTIONS.findIndex((option) => option.value === current);
      return OPTIONS[(index + 1) % OPTIONS.length].value;
    });
  }

  const Active = OPTIONS.find((option) => option.value === theme)?.icon ?? Monitor;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={cycle}
      className={className}
      title={`Theme: ${theme}`}
      aria-label={`Theme: ${theme}. Click to change.`}
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
