"use client";
import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Activity, BookOpen, Building2, FolderOpen, LayoutDashboard, LogOut } from "lucide-react";
import { useMe, useLogout } from "@/hooks/useAuth";
import { ThemeToggle } from "./themeToggle";
import { cn } from "@/lib/utils/classNameUtils";
const LINKS = [
  { href: "/dashboard", label: "Vue d’ensemble", icon: LayoutDashboard, id: "dashboard" },
  { href: "/tenders", label: "Mes dossiers", icon: FolderOpen, id: "tenders" },
  { href: "/company", label: "Mon entreprise", icon: Building2, id: "company" },
  { href: "/dashboard/controle", label: "Contrôle", icon: Activity, id: "controle" },
];
// The menu row and the floating group are the only two shapes in here; everything
// else is the same link rendered wide (drawer) or square (rail).
const MENU_ROW = "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition hover:bg-soft hover:text-foreground";
const GROUP = "rounded-2xl border border-border bg-surface p-1.5 shadow-card";
interface SidebarProps { mobile?: boolean; onNavigate?: () => void }
export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const path = usePathname();
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();
  const account = useRef<HTMLDetailsElement>(null);
  /** The label that appears beside a rail button on hover — CSS only, no tooltip library. */
  function railLabel(label: string) {
    return <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-mini text-background opacity-0 transition duration-200 group-hover:opacity-100">{label}</span>;
  }
  function navItem(item: typeof LINKS[number]) {
    const active = item.href === "/dashboard" ? path === item.href : path.startsWith(item.href);
    const shared = cn("group relative flex items-center transition duration-200 hover:bg-soft", active ? "bg-soft font-semibold text-accent" : "text-muted");
    return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} aria-label={mobile ? undefined : item.label} data-testid={`${mobile ? "mobile-" : ""}nav-${item.id}`} className={cn(shared, mobile ? "justify-center gap-2.5 rounded-lg px-3 py-2.5 text-sm" : "h-10 w-10 justify-center rounded-xl")}>
      <item.icon size={17} strokeWidth={1.7} />{mobile ? item.label : railLabel(item.label)}
    </Link>;
  }
  return (
    <div className={cn("flex h-full flex-col", mobile ? "px-3 py-4" : "items-center py-4")}>
      <nav aria-label="Navigation principale" className={cn(mobile ? "space-y-1" : cn(GROUP, "my-auto space-y-1"))}>{LINKS.map(navItem)}</nav>
      <div className={mobile ? "mt-auto" : undefined}>
        <details ref={account} className={cn("relative", !mobile && GROUP)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) account.current?.removeAttribute("open"); }}>
          <summary className={cn("group flex cursor-pointer list-none items-center rounded-lg hover:bg-soft [&::-webkit-details-marker]:hidden", mobile ? "gap-2.5 px-3 py-2.5" : "h-10 w-10 justify-center rounded-xl")} aria-label={mobile ? undefined : me.data?.name} data-testid={`${mobile ? "mobile-" : ""}workspace-account`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-soft text-mini font-semibold uppercase">{me.data?.name.slice(0, 2)}</span>
            {mobile ? <span className="min-w-0 flex-1 truncate text-xs font-medium">{me.data?.name}</span> : railLabel(me.data?.name ?? "Mon compte")}
          </summary>
          <div className="absolute bottom-full left-0 z-40 mb-2 w-56 rounded-xl border border-border bg-surface p-1 shadow-card">
            <p className="border-b border-border px-3 py-2 text-mini text-muted" data-testid={`${mobile ? "mobile-" : ""}workspace-email`}>{me.data?.email}</p>
            <Link href="/dashboard/guide" onClick={onNavigate} className={MENU_ROW} data-testid={`${mobile ? "mobile-" : ""}nav-guide`}><BookOpen size={15} />Guide de démarrage</Link>
            <ThemeToggle menu testId={`${mobile ? "mobile-" : ""}workspace-theme`} />
            <button className={cn(MENU_ROW, "disabled:opacity-50")} data-testid={`${mobile ? "mobile-" : ""}workspace-logout`} disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}>
              <LogOut size={15} />{logout.isPending ? "Déconnexion…" : "Se déconnecter"}
            </button>
            {logout.isError && <p role="alert" className="px-3 py-1 text-mini text-warning">{logout.error.message}</p>}
          </div>
        </details>
      </div>
    </div>
  );
}
