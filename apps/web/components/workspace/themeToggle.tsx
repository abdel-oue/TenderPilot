"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
const subscribe = () => () => {};
export function ThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";
  return <button className="cursor-pointer rounded-lg p-2.5 text-muted transition hover:bg-soft hover:text-foreground" aria-label={dark ? "Activer le thème clair" : "Activer le thème sombre"} data-testid="workspace-theme" onClick={() => setTheme(dark ? "light" : "dark")}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>;
}
