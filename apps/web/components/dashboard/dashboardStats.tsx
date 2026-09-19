"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, FolderOpen, CircleCheck, ScanLine, ShieldAlert } from "lucide-react";
import type { TenderListItem } from "@/lib/types";
import { dashboardSummary } from "@/lib/utils/dashboardUtils";
import { CARD } from "@/lib/utils/workspaceStyleUtils";
import { fadeUp, stagger } from "@/lib/utils/motionUtils";
import { cn } from "@/lib/utils/classNameUtils";
interface DashboardStatsProps { tenders: TenderListItem[] }
export function DashboardStats({ tenders }: DashboardStatsProps) {
  const reduced = useReducedMotion();
  const { counts, total } = dashboardSummary(tenders);
  const stats = [
    { label: "Dossiers déposés", value: total, description: "Toutes vos opportunités", icon: FolderOpen },
    { label: "Décisions go", value: counts.go, description: "Dossiers à poursuivre", icon: CircleCheck },
    { label: "Analyses en cours", value: counts.active, description: "Vos documents sont à l’étude", icon: ScanLine },
    { label: "Décisions no-go", value: counts["no-go"], description: "Points bloquants identifiés", icon: ShieldAlert },
  ];
  // Four cards arriving together read as one block; arriving in sequence they
  // read as four numbers, which is what they are.
  return <motion.div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="dashboard-stats" variants={stagger(reduced)} initial="hidden" animate="visible">{stats.map((stat, index) => <motion.div key={stat.label} variants={fadeUp(reduced, 8)}><Link href="/tenders" className={cn(CARD, "block", "group p-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-card")}><div className="flex items-center justify-between gap-2"><span className="text-mini font-medium text-muted">{stat.label}</span><stat.icon size={15} strokeWidth={1.5} className="shrink-0 text-accent" /></div><p className="mt-2.5 font-heading text-2xl tabular-nums" data-testid={`stat-${index}`}>{stat.value.toString().padStart(2, "0")}</p><div className="mt-1.5 flex items-center justify-between gap-2"><span className="text-mini text-muted">{stat.description}</span><ArrowUpRight size={13} className="text-muted transition group-hover:text-accent" /></div></Link></motion.div>)}</motion.div>;
}
