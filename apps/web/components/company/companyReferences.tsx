"use client";
import { useState } from "react";
import { Briefcase } from "lucide-react";
import type { CompanyBundle } from "@/lib/api/company";
import { useDensity } from "@/hooks/useDensity";
import { DensityToggle } from "@/components/ui/densityToggle";
import { FilterPills } from "@/components/ui/filterPills";
import { cn } from "@/lib/utils/classNameUtils";
interface CompanyReferencesProps { references: CompanyBundle["references"] }
export function CompanyReferences({ references }: CompanyReferencesProps) {
  const [secteur, setSecteur] = useState("all");
  const [density, setDensity] = useDensity("references");
  const dense = density === "compact";
  const filters = [{ value: "all", label: "Tous les secteurs" }, ...[...new Set(references.map((reference) => reference.secteur))].map((value) => ({ value, label: value }))];
  const rows = references.filter((reference) => secteur === "all" || reference.secteur === secteur);
  return <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-heading text-2xl">Vos références</h2><p className="mt-2 text-sm leading-6 text-muted">Les marchés déjà livrés, confrontés aux exigences de chaque nouveau dossier.</p></div><DensityToggle list="references" density={density} onChange={setDensity} /></div>
    <FilterPills options={filters} value={secteur} onChange={setSecteur} label="Filtrer les références par secteur" testIdPrefix="reference-filter" />
    <ul data-testid="company-references" className={dense ? "space-y-1" : "space-y-2"}>{rows.length ? rows.map((reference) => <li key={reference.id} className={cn("flex items-center gap-3 rounded-xl border border-border bg-surface", dense ? "px-4 py-2" : "p-4")}><Briefcase size={dense ? 16 : 20} className="shrink-0 text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{reference.client} · <span className="font-normal text-muted">{reference.secteur}</span></p>{!dense && <p className="mt-1 text-xs leading-5 text-muted">{reference.objet}</p>}</div><span className="shrink-0 text-mini text-muted">{reference.id}</span></li>) : <li className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">{references.length ? "Aucune référence dans ce secteur." : "Importez votre profil pour faire apparaître vos références."}</li>}</ul>
  </section>;
}
