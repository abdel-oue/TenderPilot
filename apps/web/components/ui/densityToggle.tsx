"use client";
import { Rows2, Rows3 } from "lucide-react";
import type { Density } from "@/hooks/useDensity";
import { cn } from "@/lib/utils/classNameUtils";
const OPTIONS: { value: Density; label: string; icon: typeof Rows2 }[] = [
  { value: "normal", label: "Vue normale", icon: Rows3 },
  { value: "compact", label: "Vue compacte", icon: Rows2 },
];
interface DensityToggleProps { list: string; density: Density; onChange: (value: Density) => void }
export function DensityToggle({ list, density, onChange }: DensityToggleProps) {
  return <div className="flex shrink-0 gap-1" aria-label="Densité d’affichage">{OPTIONS.map((option) => <button key={option.value} className={cn("cursor-pointer rounded-lg p-2 transition duration-200", density === option.value ? "bg-accent-soft text-accent" : "text-muted hover:bg-soft")} aria-pressed={density === option.value} aria-label={option.label} title={option.label} data-testid={`density-${list}-${option.value}`} onClick={() => onChange(option.value)}><option.icon size={16} /></button>)}</div>;
}
