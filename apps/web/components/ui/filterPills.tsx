"use client";
import { cn } from "@/lib/utils/classNameUtils";
interface FilterPillsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  testIdPrefix?: string;
}
export function FilterPills<T extends string>({ options, value, onChange, label, testIdPrefix = "filter" }: FilterPillsProps<T>) {
  return <div className="flex flex-wrap gap-1" aria-label={label}>{options.map((option) => <button key={option.value} className={cn("cursor-pointer rounded-lg px-3 py-2 text-xs transition duration-200", value === option.value ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-soft")} aria-pressed={value === option.value} onClick={() => onChange(option.value)} data-testid={`${testIdPrefix}-${option.value}`}>{option.label}</button>)}</div>;
}
