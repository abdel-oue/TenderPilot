"use client";
import { useSyncExternalStore } from "react";
export type Density = "compact" | "normal";
// localStorage is the store; the server (and the first client render) has no access
// to it, so the server snapshot is always "normal" and the real value arrives on
// hydration. Same mount-guard idea as components/workspace/themeToggle.tsx.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function read(storageKey: string): Density {
  try { return localStorage.getItem(storageKey) === "compact" ? "compact" : "normal"; } catch { return "normal"; }
}
/**
 * Row density for one list, remembered across visits under its own key.
 * @param key list name, e.g. "tenders"
 * @returns the current density and a setter that persists it
 */
export function useDensity(key: string): [Density, (value: Density) => void] {
  const storageKey = `tenderpilot-density-${key}`;
  const density = useSyncExternalStore(subscribe, () => read(storageKey), (): Density => "normal");
  function update(value: Density) {
    try { localStorage.setItem(storageKey, value); } catch { /* private mode: the choice just does not stick */ }
    for (const listener of listeners) listener();
  }
  return [density, update];
}
