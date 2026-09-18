import Link from "next/link";
import { ArrowUpRight, FolderOpen, CircleCheck, ScanLine, ShieldAlert } from "lucide-react";
import type { TenderListItem } from "@/lib/types";
import { dashboardSummary } from "@/lib/utils/dashboardUtils";
import { CARD } from "@/lib/utils/workspaceStyleUtils";
import { cn } from "@/lib/utils/classNameUtils";
interface DashboardStatsProps { tenders: TenderListItem[] }
export function DashboardStats({ tenders }: DashboardStatsProps) {
  const { counts, total } = dashboardSummary(tenders);
  const stats = [
    { label: "Dossiers déposés", value: total, description: "Toutes vos opportunités", icon: FolderOpen },
    { label: "Décisions go", value: counts.go, description: "Dossiers à poursuivre", icon: CircleCheck },
    { label: "Analyses en cours", value: counts.active, description: "Vos documents sont à l’étude", icon: ScanLine },
    { label: "Décisions no-go", value: counts["no-go"], description: "Points bloquants identifiés", icon: ShieldAlert },
  ];
  return <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4" data-testid="dashboard-stats">{stats.map((stat, index) => <Link href="/tenders" key={stat.label} className={cn(CARD, "group p-4 md:p-5 transition duration-200 hover:-translate-y-1 hover:shadow-card")}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted">{stat.label}</span><stat.icon size={18} strokeWidth={1.5} className="shrink-0 text-accent" /></div><p className="mt-5 font-heading text-4xl tabular-nums" data-testid={`stat-${index}`}>{stat.value.toString().padStart(2, "0")}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted">{stat.description}</span><ArrowUpRight size={14} className="text-muted transition group-hover:text-accent" /></div></Link>)}</div>;
}
