"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/classNameUtils";
const subscribe = () => () => {};
interface ThemeToggleProps { menu?: boolean; testId?: string }
export function ThemeToggle({ menu = false, testId = "workspace-theme" }: ThemeToggleProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Activer le thème clair" : "Activer le thème sombre";
  return <button className={cn("cursor-pointer rounded-lg text-muted transition hover:bg-soft hover:text-foreground", menu ? "flex w-full items-center gap-2 px-3 py-2 text-xs" : "p-2.5")} aria-label={label} data-testid={testId} onClick={() => setTheme(dark ? "light" : "dark")}>{dark ? <Sun size={menu ? 15 : 19} /> : <Moon size={menu ? 15 : 19} />}{menu && <span>{dark ? "Thème clair" : "Thème sombre"}</span>}</button>;
}
