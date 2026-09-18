"use client";
import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Activity, BookOpen, Building2, FolderOpen, LayoutDashboard, LogOut } from "lucide-react";
import { useMe, useLogout } from "@/hooks/useAuth";
import { cn } from "@/lib/utils/classNameUtils";
const LINKS = [
  { href: "/dashboard", label: "Vue d’ensemble", icon: LayoutDashboard, id: "dashboard" },
  { href: "/tenders", label: "Mes dossiers", icon: FolderOpen, id: "tenders" },
  { href: "/company", label: "Mon entreprise", icon: Building2, id: "company" },
  { href: "/dashboard/controle", label: "Contrôle", icon: Activity, id: "controle" },
];
interface SidebarProps { mobile?: boolean; onNavigate?: () => void }
export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const path = usePathname();
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();
  const account = useRef<HTMLDetailsElement>(null);
  function navItem(item: typeof LINKS[number]) {
    const active = item.href === "/dashboard" ? path === item.href : path.startsWith(item.href);
    return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} data-testid={`${mobile ? "mobile-" : ""}nav-${item.id}`} className={cn("flex items-center justify-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition duration-200 hover:bg-soft", active ? "bg-soft font-semibold text-accent" : "text-muted")}><item.icon size={17} strokeWidth={1.7} />{item.label}</Link>;
  }
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <nav aria-label="Navigation principale" className="space-y-1">{LINKS.map(navItem)}</nav>
      <div className="mt-auto space-y-1">
        <nav aria-label="Ressources">{navItem({ href: "/dashboard/guide", label: "Guide de démarrage", icon: BookOpen, id: "guide" })}</nav>
        <details ref={account} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) account.current?.removeAttribute("open"); }}>
          <summary className="flex cursor-pointer list-none flex-col items-center gap-1.5 rounded-lg px-3 py-3 hover:bg-soft [&::-webkit-details-marker]:hidden" data-testid={`${mobile ? "mobile-" : ""}workspace-account`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft text-mini font-semibold uppercase">{me.data?.name.slice(0, 2)}</span>
            <span className="w-full min-w-0 text-center"><span className="block truncate text-xs font-medium">{me.data?.name}</span><span className="block truncate text-mini text-muted">{me.data?.email}</span></span>
          </summary>
          <div className="absolute inset-x-0 bottom-full mb-1 rounded-lg border border-border bg-surface p-1 shadow-card">
            <button className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-muted hover:bg-soft hover:text-foreground disabled:opacity-50" data-testid={`${mobile ? "mobile-" : ""}workspace-logout`} disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}>
              <LogOut size={15} />{logout.isPending ? "Déconnexion…" : "Se déconnecter"}
            </button>
            {logout.isError && <p role="alert" className="px-3 py-1 text-mini text-warning">{logout.error.message}</p>}
          </div>
        </details>
      </div>
    </div>
  );
}
