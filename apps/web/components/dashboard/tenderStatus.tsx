import { Circle, CircleCheck, CircleX, Loader2, AlertCircle } from "lucide-react";
import type { TenderListItem } from "@/lib/types";
import { tenderState } from "@/lib/utils/dashboardUtils";
import { cn } from "@/lib/utils/classNameUtils";
const STATUS = {
  go: { label: "Go", icon: CircleCheck, className: "bg-accent-soft text-positive" },
  "no-go": { label: "No-go", icon: CircleX, className: "bg-warning-soft text-warning" },
  active: { label: "En analyse", icon: Loader2, className: "bg-soft text-accent" },
  pending: { label: "À analyser", icon: Circle, className: "bg-soft text-muted" },
  failed: { label: "À relancer", icon: AlertCircle, className: "bg-warning-soft text-warning" },
};
interface TenderStatusProps { tender: TenderListItem }
export function TenderStatus({ tender }: TenderStatusProps) {
  const state = tenderState(tender);
  const status = tender.analysis?.status === "queued"
    ? { label: "En file d’attente", icon: Circle, className: "bg-soft text-muted" }
    : STATUS[state];
  return <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", status.className)}><status.icon size={12} className={cn(state === "active" && "animate-spin")} />{status.label}</span>;
}
