import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export const metadata = { title: "Guide de démarrage — TenderPilot" };
const STEPS = [
  { title: "Présentez votre entreprise", text: "Importez votre profil, vos références et les profils de votre équipe. Ajoutez vos attestations et vos précédents mémoires pour documenter vos capacités.", href: "/company", action: "Compléter mon entreprise" },
  { title: "Déposez un appel d’offres", text: "Créez un dossier avec sa référence, puis ajoutez ses PDF : avis, CPS et règlement de consultation. Choisissez le type correspondant à chaque pièce.", href: "/tenders/new", action: "Créer un dossier" },
  { title: "Lancez et examinez l’analyse", text: "Ouvrez votre dossier et lancez l’analyse. Consultez le go / no-go, les points bloquants et la matrice de conformité. Chaque citation renvoie à sa page source.", href: "/tenders", action: "Retrouver mes dossiers" },
  { title: "Préparez votre réponse", text: "Pour un dossier en go, relisez les sections du mémoire technique, complétez les informations manquantes et enregistrez vos corrections avant l’export. Vérifiez toujours les sources avant de prendre votre décision.", href: "/tenders", action: "Ouvrir un dossier" },
];
export default function Page() {
  return <main className="mx-auto max-w-4xl space-y-8 px-5 py-10 md:px-9"><header><p className="mb-3 text-mini font-semibold tracking-label text-accent uppercase">Le guide TenderPilot</p><h1 className="font-heading text-4xl">Du document à la décision.</h1><p className="mt-4 text-sm text-muted">Quatre étapes pour prendre en main votre espace.</p></header><div className="space-y-4">{STEPS.map((step, index) => <section key={step.title} className="flex gap-5 rounded-2xl border border-border bg-surface p-6"><span className="font-heading text-3xl text-accent/60">0{index + 1}</span><div><h2 className="font-semibold">{step.title}</h2><p className="mt-3 text-sm leading-7 text-muted">{step.text}</p><Link href={step.href} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-accent">{step.action} <ArrowUpRight size={14} /></Link></div></section>)}</div></main>;
}
