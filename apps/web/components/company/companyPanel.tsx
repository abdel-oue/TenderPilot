"use client";
import { useState } from "react";
import { Building2, CheckCircle2, Upload } from "lucide-react";
import { useCompany, useImportCompanyProfile } from "@/hooks/useCompany";
import { CompanyDocuments } from "./companyDocuments";
import { CompanyReferences } from "./companyReferences";
import { PRIMARY, SECONDARY } from "@/lib/utils/workspaceStyleUtils";
export default function CompanyPanel() {
  const company = useCompany();
  const importProfile = useImportCompanyProfile();
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  async function submit() {
    if (!profileFile || reading || importProfile.isPending) return;
    setValidation(null);
    setReading(true);
    try {
      const profile: unknown = JSON.parse(await profileFile.text());
      importProfile.mutate(profile);
    } catch { setValidation("Ce fichier ne contient pas un profil JSON valide. Vérifiez son contenu puis réessayez."); }
    finally { setReading(false); }
  }
  if (company.isPending) return <div className="h-64 animate-pulse rounded-2xl bg-soft" />;
  if (company.isError) return <div role="alert" className="space-y-3 rounded-2xl border border-border bg-surface p-6"><p className="text-sm text-warning">{company.error.message}</p><button className={SECONDARY} onClick={() => void company.refetch()}>Réessayer</button></div>;
  const { profile, references, team } = company.data;
  return <div className="space-y-9">
    <section className="rounded-2xl border border-border bg-surface p-6 md:p-7">
      <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-accent-soft p-3 text-accent"><Building2 size={22} /></span><div><h2 className="font-semibold">Profil de l’entreprise</h2><p className="mt-1 text-xs text-muted">La base d’une analyse adaptée à vos capacités.</p></div></div>
      {profile ? <div data-testid="company-profile"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-heading text-2xl">{profile.raisonSociale}</h3><span className="flex items-center gap-1.5 text-xs text-positive"><CheckCircle2 size={15} /> Profil renseigné</span></div><p className="mt-3 text-sm text-muted">ICE {profile.ice} · {profile.siege}</p><div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-6">{[{ value: profile.effectif, label: "Collaborateurs" }, { value: references.length, label: "Références" }, { value: team.length, label: "Profils équipe" }].map((item) => <div key={item.label}><p className="font-heading text-2xl">{item.value}</p><p className="mt-1 text-xs text-muted">{item.label}</p></div>)}</div><div className="mt-5 flex flex-wrap gap-2">{profile.certifications.map((certification) => <span key={certification} className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">{certification}</span>)}</div></div> : <div className="space-y-5"><div className="rounded-xl bg-accent-soft p-4"><h3 className="text-sm font-medium">Bienvenue dans votre espace.</h3><p className="mt-2 text-sm leading-6 text-muted">Commencez par importer le fichier de profil de votre entreprise. Il rassemble vos informations, vos références et votre équipe.</p></div><label className="block space-y-2 text-sm font-medium">Fichier de profil (.json)<input type="file" accept=".json,application/json" data-testid="company-profile-file" disabled={reading || importProfile.isPending} className="block w-full cursor-pointer rounded-xl border border-border p-3 text-xs file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-soft file:px-3 file:py-2 file:text-foreground" onChange={(event) => { setProfileFile(event.target.files?.[0] ?? null); setValidation(null); }} /></label><button className={PRIMARY} data-testid="company-import" disabled={!profileFile || reading || importProfile.isPending} onClick={() => void submit()}><Upload size={16} />{reading || importProfile.isPending ? "Import en cours…" : "Importer mon profil"}</button>{(validation || importProfile.isError) && <p role="alert" data-testid="company-import-error" className="text-sm text-warning">{validation ?? importProfile.error?.message}</p>}</div>}
    </section>
    {profile && <CompanyReferences references={references} />}
    <CompanyDocuments />
  </div>;
}