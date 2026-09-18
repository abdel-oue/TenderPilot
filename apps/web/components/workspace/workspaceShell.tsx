"use client";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, Plus, ChevronRight } from "lucide-react";
import RequireSession from "@/components/auth/requireSession";
import { BrandLogo } from "@/components/landing/brandLogo";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./themeToggle";
import { Reveal } from "@/components/ui/reveal";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
interface WorkspaceShellProps { children: React.ReactNode }
export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const title = path.startsWith("/tenders") ? "Mes dossiers" : path.startsWith("/company") ? "Mon entreprise" : path.endsWith("controle") ? "Contrôle" : path.endsWith("guide") ? "Guide de démarrage" : "Vue d’ensemble";
  function close() { setOpen(false); }
  return (
    <RequireSession>
      <a href="#workspace-main" className="fixed -top-20 left-5 z-50 rounded-xl bg-surface p-3 focus:top-4">Aller au contenu</a>
      {/* One background across the whole workspace: the rail and the top bar float on it, no panels, no rules. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 overflow-y-auto bg-background lg:block"><Sidebar /></aside>
      <dialog ref={dialog} onClose={() => setOpen(false)} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-72 max-w-full bg-background text-foreground backdrop:bg-foreground/30" aria-label="Menu de navigation" data-testid="workspace-drawer">
        <AnimatePresence onExitComplete={() => dialog.current?.close()}>{open && <motion.div className="relative h-full" initial={{ opacity: 0, x: reduced ? 0 : -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -20 }} transition={{ duration: 0.2 }}><button autoFocus className="absolute right-3 top-3 cursor-pointer rounded-lg p-2 hover:bg-soft" aria-label="Fermer le menu" onClick={close}><X size={18} /></button><Sidebar mobile onNavigate={close} /></motion.div>}</AnimatePresence>
      </dialog>
      <div className="min-h-screen bg-background lg:pl-56">
        <header className="sticky top-0 z-20 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-background px-4 md:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <button className="cursor-pointer rounded-lg p-2 hover:bg-soft lg:hidden" aria-label="Ouvrir le menu" aria-expanded={open} data-testid="workspace-menu" onClick={() => { setOpen(true); dialog.current?.showModal(); }}><Menu size={19} /></button>
            <span className="hidden text-mini text-muted md:inline">Espace de travail</span><ChevronRight className="hidden text-muted md:block" size={13} /><span className="truncate text-xs font-medium">{title}</span>
          </div>
          <Link href="/dashboard" aria-label="TenderPilot — Accueil" className="justify-self-center" data-testid="workspace-logo"><BrandLogo className="h-7 w-9 sm:w-9 md:w-9" /></Link>
          <div className="flex items-center justify-end gap-1 justify-self-end"><ThemeToggle /><Link href="/tenders/new" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-soft" aria-label="Nouveau dossier"><Plus size={16} /><span className="hidden md:inline">Nouveau dossier</span></Link></div>
        </header>
        <div id="workspace-main" tabIndex={-1}><Reveal key={path}>{children}</Reveal></div>
      </div>
    </RequireSession>
  );
}
