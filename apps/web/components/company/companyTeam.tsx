"use client";
import { useState } from "react";
import type { CompanyBundle } from "@/lib/api/company";
import { useDensity } from "@/hooks/useDensity";
import { DensityToggle } from "@/components/ui/densityToggle";
import { FilterPills } from "@/components/ui/filterPills";
import { cn } from "@/lib/utils/classNameUtils";
interface CompanyTeamProps { team: CompanyBundle["team"] }
// A table rather than cards: fourteen profiles read as a roster, and the agent
// scores personnel requirements on exactly these columns.
export function CompanyTeam({ team }: CompanyTeamProps) {
  const [poste, setPoste] = useState("all");
  const [density, setDensity] = useDensity("team");
  const dense = density === "compact";
  const filters = [{ value: "all", label: "Tous les postes" }, ...[...new Set(team.map((member) => member.poste))].map((value) => ({ value, label: value }))];
  const rows = team.filter((member) => poste === "all" || member.poste === poste);
  const cell = dense ? "px-3 py-2" : "px-3 py-3";
  return <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-heading text-2xl">Votre équipe</h2><p className="mt-2 text-sm leading-6 text-muted">Les profils confrontés aux exigences de personnel de chaque dossier.</p></div><DensityToggle list="team" density={density} onChange={setDensity} /></div>
    <FilterPills options={filters} value={poste} onChange={setPoste} label="Filtrer l’équipe par poste" testIdPrefix="team-filter" />
    {rows.length ? <div className="overflow-x-auto rounded-xl border border-border bg-surface"><table data-testid="company-team" className="w-full min-w-150 text-left text-sm"><thead><tr className="border-b border-border text-mini text-muted">
      <th scope="col" className={cn(cell, "font-medium")}>Réf.</th>
      <th scope="col" className={cn(cell, "font-medium")}>Profil</th>
      <th scope="col" className={cn(cell, "font-medium")}>Poste</th>
      <th scope="col" className={cn(cell, "font-medium")}>Expérience</th>
      <th scope="col" className={cn(cell, "font-medium")}>Diplôme</th>
      {!dense && <th scope="col" className={cn(cell, "font-medium")}>Certifications</th>}
      {!dense && <th scope="col" className={cn(cell, "font-medium")}>Langues</th>}
    </tr></thead><tbody>{rows.map((member) => <tr key={member.id} className="border-b border-border last:border-0">
      <td className={cn(cell, "text-mini text-muted")}>{member.id}</td>
      <td className={cn(cell, "font-medium")}>{member.initiales}</td>
      <td className={cell}>{member.poste}</td>
      <td className={cn(cell, "whitespace-nowrap")}>{member.anneesExperience} ans</td>
      <td className={cn(cell, "text-muted")}>{member.diplome}</td>
      {!dense && <td className={cell}><span className="flex flex-wrap gap-1">{member.certifications.map((certification) => <span key={certification} className="rounded-full bg-accent-soft px-2 py-0.5 text-mini text-accent">{certification}</span>)}</span></td>}
      {!dense && <td className={cn(cell, "text-mini text-muted")}>{member.langues.join(" · ")}</td>}
    </tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">{team.length ? "Aucun profil pour ce poste." : "Importez votre profil pour faire apparaître votre équipe."}</p>}
  </section>;
}
