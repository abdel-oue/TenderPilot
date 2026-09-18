"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderOpen, Search, X } from "lucide-react";
import type { TenderListItem } from "@/lib/types";
import { filterTenders, shortDate, type TenderFilter } from "@/lib/utils/dashboardUtils";
import { CARD, INPUT, PRIMARY } from "@/lib/utils/workspaceStyleUtils";
import { cn } from "@/lib/utils/classNameUtils";
import { TenderStatus } from "./tenderStatus";
const FILTERS: { value: TenderFilter; label: string }[] = [{ value: "all", label: "Tous" }, { value: "go", label: "Go" }, { value: "no-go", label: "No-go" }, { value: "active", label: "En analyse" }, { value: "pending", label: "À analyser" }, { value: "failed", label: "À relancer" }];
interface TenderTableProps { tenders: TenderListItem[]; compact?: boolean }
export function TenderTable({ tenders, compact = false }: TenderTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TenderFilter>("all");
  const matching = filterTenders(tenders, search, filter);
  const rows = compact ? matching.slice(0, 5) : matching;
  return (
    <section className={cn(CARD, "overflow-hidden")} data-testid="tender-list">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 md:px-6"><div><h2 className="font-semibold">{compact ? "Dossiers récents" : "Tous les dossiers"}</h2><p className="mt-1 text-xs text-muted">{compact ? "Vos dernières opportunités, en un coup d’œil." : `${matching.length} dossier(s) dans votre espace`}</p></div>{compact ? <Link href="/tenders" className="flex items-center gap-2 text-xs font-medium text-accent">Tout voir <ArrowUpRight size={15} /></Link> : <div className="relative w-full md:w-64"><Search size={16} className="absolute left-3 top-3.5 text-muted" /><input className={cn(INPUT, "pl-10 pr-10")} placeholder="Rechercher un dossier…" aria-label="Rechercher un dossier" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="tender-search" />{search && <button className="absolute right-2 top-2 cursor-pointer p-1.5 text-muted" aria-label="Effacer la recherche" onClick={() => setSearch("")}><X size={16} /></button>}</div>}</div>
      {!compact && <div className="flex flex-wrap gap-1 border-b border-border px-4 py-3" aria-label="Filtrer les dossiers">{FILTERS.map((item) => <button key={item.value} className={cn("cursor-pointer rounded-lg px-3 py-2 text-xs transition duration-200", filter === item.value ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-soft")} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} data-testid={`filter-${item.value}`}>{item.label}</button>)}</div>}
      {rows.length ? <div className="divide-y divide-border">{rows.map((tender) => <Link key={tender.id} href={`/tenders/${tender.id}`} className="group flex items-center gap-3 px-5 py-5 transition duration-200 hover:bg-soft/60 md:gap-5 md:px-6" data-testid="tender-row"><span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-accent md:flex"><FolderOpen size={21} strokeWidth={1.5} /></span><div className="min-w-0 flex-1"><p className="text-xs text-muted">{tender.reference}</p><p className="mt-1 truncate text-sm font-medium">{tender.title ?? "Dossier sans titre"}</p><p className="mt-1 truncate text-xs text-muted">{tender.buyer ?? "Acheteur non renseigné"}</p></div><div className="hidden text-right md:block"><p className="text-mini text-muted">Date limite</p><p className="mt-1 text-xs">{shortDate(tender.deadline)}</p></div><TenderStatus tender={tender} /><ArrowUpRight size={16} className="hidden text-muted transition group-hover:text-accent md:block" /></Link>)}</div> : <div className="flex flex-col items-center px-6 py-14 text-center" data-testid="tenders-empty"><FolderOpen size={32} strokeWidth={1.3} className="mb-4 text-accent" /><h3 className="font-heading text-2xl">{tenders.length ? "Aucun dossier correspondant" : "Votre prochaine opportunité vous attend."}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted">{tenders.length ? "Essayez une autre recherche ou un autre filtre." : "Importez votre premier appel d’offres pour commencer à y voir plus clair."}</p>{tenders.length ? <button className="mt-5 cursor-pointer text-sm font-medium text-accent" onClick={() => { setSearch(""); setFilter("all"); }}>Réinitialiser les filtres</button> : <Link href="/tenders/new" className={cn(PRIMARY, "mt-6")}>Créer mon premier dossier</Link>}</div>}
    </section>
  );
}
