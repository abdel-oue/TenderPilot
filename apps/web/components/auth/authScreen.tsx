import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, FileCheck2, ScanLine } from "lucide-react";
import { BrandLogo } from "@/components/landing/brandLogo";
import { AuthPanel } from "./authPanel";
import type { AuthMode } from "@/lib/utils/authUtils";
interface AuthScreenProps { mode: AuthMode }
export function AuthScreen({ mode }: AuthScreenProps) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2" id="main">
      <section className="flex flex-col px-6 py-7 md:px-14 lg:px-18">
        <Link href="/" aria-label="TenderPilot — Accueil" className="w-fit"><BrandLogo /></Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-14"><AuthPanel mode={mode} /></div>
        <Link href="/" className="flex w-fit items-center gap-2 text-xs text-muted hover:text-foreground"><ArrowLeft size={14} /> Retour à l’accueil</Link>
      </section>
      <aside className="relative m-4 ml-0 hidden overflow-hidden rounded-3xl bg-inverse-surface p-14 text-inverse lg:flex lg:flex-col lg:justify-between">
        <div className="auth-orbit pointer-events-none absolute inset-0" aria-hidden="true" />
        <p className="relative flex items-center gap-2 text-xs tracking-label uppercase"><span className="h-2 w-2 rounded-full bg-inverse-muted" /> Moins d’incertitude. Plus de perspectives.</p>
        <div className="relative py-12">
          <h2 className="max-w-lg font-heading text-5xl leading-tight tracking-tight">Vos appels d’offres.<br /><span className="text-inverse-muted">Les idées claires.</span></h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-inverse-muted">Du premier document à la décision finale, gardez une vue d’ensemble sur ce qui compte vraiment.</p>
          <div className="mt-12 rounded-2xl border border-inverse-border bg-inverse-surface/90 p-6 shadow-card">
            <div className="flex items-center justify-between"><span className="flex items-center gap-3 text-sm"><FileCheck2 size={20} /> Votre dossier, décrypté</span><ScanLine size={20} className="text-inverse-muted" /></div>
            <div className="my-5 h-px bg-inverse-border" />
            {["Exigences extraites et sourcées", "Compatibilité avec votre entreprise", "Décision go / no-go argumentée"].map((text) => <p key={text} className="mt-4 flex items-center gap-3 text-sm text-inverse-muted"><Check size={16} className="text-inverse" />{text}</p>)}
            <div className="mt-6 flex items-center justify-between border-t border-inverse-border pt-4 text-xs text-inverse-muted"><span>L’analyse éclaire. Vous décidez.</span><ArrowUpRight size={17} /></div>
          </div>
        </div>
        <p className="relative text-xs text-inverse-muted">Pensé pour les entreprises qui veulent aller plus loin.</p>
      </aside>
    </main>
  );
}
