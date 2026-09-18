"use client";
import Link from "next/link";
import { ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { useMe } from "@/hooks/useAuth";
import { useTenders } from "@/hooks/useTenders";
import { DashboardStats } from "./dashboardStats";
import { DashboardInsights } from "./dashboardInsights";
import { TenderTable } from "./tenderTable";
import { DataFeedback } from "./dataFeedback";
import { PRIMARY } from "@/lib/utils/workspaceStyleUtils";
export function DashboardOverview() {
  const me = useMe();
  const tenders = useTenders();
  return <main className="mx-auto max-w-screen-2xl space-y-7 px-5 py-8 md:px-9 md:py-10" data-testid="dashboard">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-mini font-semibold tracking-label text-muted uppercase">Votre tableau de bord</p><h1 className="font-heading text-3xl tracking-tight md:text-4xl">Bonjour, {me.data?.name.split(" ")[0] ?? "vous"}<span className="text-accent">.</span></h1><p className="mt-3 text-sm text-muted">Une vue claire sur vos dossiers. Une décision à la fois.</p></div><Link href="/tenders/new" className={PRIMARY} data-testid="dashboard-new"><Plus size={17} /> Nouveau dossier</Link></header>
    <DataFeedback pending={tenders.isPending} error={tenders.error} retry={() => void tenders.refetch()} />
    {tenders.data && !tenders.isError && <><DashboardStats tenders={tenders.data} /><div className="grid items-start gap-6 xl:grid-cols-3"><div className="min-w-0 space-y-6 xl:col-span-2"><section className="relative overflow-hidden rounded-2xl bg-inverse-surface p-6 text-inverse md:p-8"><div className="auth-orbit pointer-events-none absolute inset-0" aria-hidden="true" /><div className="relative"><p className="flex items-center gap-2 text-mini font-medium tracking-label text-inverse-muted uppercase"><Sparkles size={15} /> Votre copilote pour les appels d’offres</p><h2 className="mt-5 max-w-sm font-heading text-3xl leading-tight">Le bon dossier.<br />La bonne décision.</h2><p className="mt-4 max-w-md text-sm leading-6 text-inverse-muted">Déposez vos documents. Retrouvez les exigences, les points bloquants et une recommandation argumentée.</p><Link href="/tenders/new" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-inverse">Analyser un nouveau dossier <ArrowUpRight size={16} /></Link></div></section><TenderTable tenders={tenders.data} compact /><p className="px-1 text-xs leading-5 text-muted">Les recommandations vous accompagnent. La décision finale reste la vôtre.</p></div><DashboardInsights tenders={tenders.data} /></div></>}
  </main>;
}
