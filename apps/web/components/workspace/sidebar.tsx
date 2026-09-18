"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, FolderOpen, LayoutDashboard, Settings2 } from "lucide-react";
import { BrandLogo } from "@/components/landing/brandLogo";
import { useMe } from "@/hooks/useAuth";
import { cn } from "@/lib/utils/classNameUtils";
const LINKS = [
  { href: "/dashboard", label: "Vue d’ensemble", icon: LayoutDashboard, id: "dashboard" },
  { href: "/tenders", label: "Mes dossiers", icon: FolderOpen, id: "tenders" },
  { href: "/company", label: "Mon entreprise", icon: Building2, id: "company" },
];
interface SidebarProps { mobile?: boolean; onNavigate?: () => void }
export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const path = usePathname();
  const me = useMe();
  function navItem(item: typeof LINKS[number]) {
    const active = item.href === "/dashboard" ? path === item.href : path.startsWith(item.href);
    return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} data-testid={`${mobile ? "mobile-" : ""}nav-${item.id}`} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition duration-200 hover:bg-soft", active ? "bg-accent-soft font-semibold text-accent" : "text-muted")}><item.icon size={19} strokeWidth={1.6} />{item.label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}</Link>;
  }
  return (
    <div className="flex h-full flex-col p-5">
      <Link href="/" aria-label="TenderPilot — Accueil" className="mb-10 mt-2 w-fit"><BrandLogo /></Link>
      <div className="mb-7 flex items-center gap-3 rounded-xl border border-border bg-background p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Building2 size={18} /></div><div className="min-w-0"><p className="truncate text-sm font-medium">Mon espace de travail</p><p className="mt-0.5 text-xs text-muted">Espace entreprise</p></div></div>
      <p className="mb-3 px-3 text-mini font-semibold tracking-label text-muted uppercase">Espace de travail</p>
      <nav aria-label="Navigation principale" className="space-y-1">{LINKS.map(navItem)}</nav>
      <div className="mt-auto pt-12">
        <nav aria-label="Ressources" className="space-y-1">{navItem({ href: "/dashboard/guide", label: "Guide de démarrage", icon: BookOpen, id: "guide" })}{navItem({ href: "/dashboard/settings", label: "Paramètres", icon: Settings2, id: "settings" })}</nav>
        <Link href="/dashboard/settings" onClick={onNavigate} className="mt-5 flex items-center gap-3 border-t border-border pt-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-semibold uppercase">{me.data?.name.slice(0, 2)}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{me.data?.name}</span><span className="block truncate text-xs text-muted">{me.data?.email}</span></span></Link>
      </div>
    </div>
  );
}
