"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderOpen, Search, X } from "lucide-react";
import type { TenderListItem } from "@/lib/types";
import { useDensity } from "@/hooks/useDensity";
import { filterTenders, shortDate, type TenderFilter } from "@/lib/utils/dashboardUtils";
import { CARD, INPUT, PRIMARY } from "@/lib/utils/workspaceStyleUtils";
import { cn } from "@/lib/utils/classNameUtils";
import { DensityToggle } from "@/components/ui/densityToggle";
import { FilterPills } from "@/components/ui/filterPills";
import { TenderStatus } from "./tenderStatus";
const FILTERS: { value: TenderFilter; label: string }[] = [{ value: "all", label: "Tous" }, { value: "go", label: "Go" }, { value: "no-go", label: "No-go" }, { value: "active", label: "En analyse" }, { value: "pending", label: "À analyser" }, { value: "failed", label: "À relancer" }];
// `compact` is the dashboard preview (five rows, no controls); `density` is the
// user's row-height choice on the full page. Two different things.
interface TenderTableProps { tenders: TenderListItem[]; compact?: boolean }
export function TenderTable({ tenders, compact = false }: TenderTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TenderFilter>("all");
  const [density, setDensity] = useDensity("tenders");
  const matching = filterTenders(tenders, search, filter);
  const rows = compact ? matching.slice(0, 5) : matching;
  const dense = !compact && density === "compact";
  return (
    <section className={cn(CARD, "overflow-hidden")} data-testid="tender-list">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5"><div><h2 className="text-sm font-semibold">{compact ? "Dossiers récents" : "Tous les dossiers"}</h2><p className="mt-0.5 text-mini text-muted">{compact ? "Vos dernières opportunités, en un coup d’œil." : `${matching.length} dossier(s) dans votre espace`}</p></div>{compact ? <Link href="/tenders" className="flex items-center gap-2 text-xs font-medium text-accent">Tout voir <ArrowUpRight size={15} /></Link> : <div className="flex w-full items-center gap-2 md:w-auto"><div className="relative min-w-0 flex-1 md:w-64 md:flex-none"><Search size={16} className="absolute left-3 top-3.5 text-muted" /><input className={cn(INPUT, "pl-10 pr-10")} placeholder="Rechercher un dossier…" aria-label="Rechercher un dossier" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="tender-search" />{search && <button className="absolute right-2 top-2 cursor-pointer p-1.5 text-muted" aria-label="Effacer la recherche" onClick={() => setSearch("")}><X size={16} /></button>}</div><DensityToggle list="tenders" density={density} onChange={setDensity} /></div>}</div>
      {!compact && <div className="border-b border-border px-4 py-3"><FilterPills options={FILTERS} value={filter} onChange={setFilter} label="Filtrer les dossiers" /></div>}
      {rows.length ? <div className="divide-y divide-border">{rows.map((tender) => <Link key={tender.id} href={`/tenders/${tender.id}`} className={cn("group flex items-center gap-3 px-4 transition duration-200 hover:bg-soft/60 md:gap-4", dense ? "py-2" : "py-3")} data-testid="tender-row"><span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-accent md:flex"><FolderOpen size={16} strokeWidth={1.5} /></span><div className="min-w-0 flex-1">{dense ? <p className="truncate text-xs"><span className="text-muted">{tender.reference}</span> · <span className="font-medium">{tender.title ?? "Dossier sans titre"}</span></p> : <><p className="text-mini text-muted">{tender.reference}</p><p className="truncate text-xs font-medium">{tender.title ?? "Dossier sans titre"}</p><p className="truncate text-mini text-muted">{tender.buyer ?? "Acheteur non renseigné"}</p></>}</div>{!dense && <div className="hidden text-right md:block"><p className="text-mini text-muted">Date limite</p><p className="text-xs">{shortDate(tender.deadline)}</p></div>}<TenderStatus tender={tender} /><ArrowUpRight size={16} className="hidden text-muted transition group-hover:text-accent md:block" /></Link>)}</div> : <div className="flex flex-col items-center px-6 py-10 text-center" data-testid="tenders-empty"><FolderOpen size={26} strokeWidth={1.3} className="mb-3 text-accent" /><h3 className="font-heading text-lg">{tenders.length ? "Aucun dossier correspondant" : "Votre prochaine opportunité vous attend."}</h3><p className="mt-1.5 max-w-sm text-xs leading-5 text-muted">{tenders.length ? "Essayez une autre recherche ou un autre filtre." : "Importez votre premier appel d’offres pour commencer à y voir plus clair."}</p>{tenders.length ? <button className="mt-5 cursor-pointer text-sm font-medium text-accent" onClick={() => { setSearch(""); setFilter("all"); }}>Réinitialiser les filtres</button> : <Link href="/tenders/new" className={cn(PRIMARY, "mt-6")}>Créer mon premier dossier</Link>}</div>}
    </section>
  );
}
