import { cn } from "@/lib/utils/classNameUtils";

interface VerdictBadgeProps {
  verdict: "go" | "no-go";
  className?: string;
}

// Colours come from the --go / --no-go tokens in globals.css. No hex here.
export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  return (
    <span
      data-testid="verdict-badge"
      data-verdict={verdict}
      className={cn(
        "inline-flex items-center rounded-md border px-3 py-1 text-sm font-semibold uppercase tracking-wide",
        verdict === "go"
          ? "border-go/40 bg-accent-soft text-go"
          : "border-no-go/40 bg-warning-soft text-no-go",
        className,
      )}
    >
      {verdict}
    </span>
  );
}
