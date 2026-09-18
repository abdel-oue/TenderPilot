"use client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun, ShieldCheck } from "lucide-react";
import { useMe, useLogout } from "@/hooks/useAuth";
import { CARD, SECONDARY } from "@/lib/utils/workspaceStyleUtils";
import { cn } from "@/lib/utils/classNameUtils";
export function AccountSettings() {
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();
  const { setTheme } = useTheme();
  return <main className="mx-auto max-w-4xl space-y-7 px-5 py-10 md:px-9"><div><h1 className="font-heading text-4xl">À votre façon.</h1><p className="mt-3 text-sm text-muted">Votre compte et vos préférences d’affichage.</p></div><section className={cn(CARD, "p-6")}><h2 className="font-semibold">Mon compte</h2><dl className="mt-6 grid gap-6 md:grid-cols-2"><div><dt className="text-xs text-muted">Nom complet</dt><dd className="mt-2 break-words text-sm">{me.data?.name}</dd></div><div><dt className="text-xs text-muted">Adresse e-mail</dt><dd className="mt-2 break-all text-sm">{me.data?.email}</dd></div></dl><p className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted"><ShieldCheck size={15} /> Votre compte dispose de son propre espace entreprise.</p></section><section className={cn(CARD, "p-6")}><h2 className="font-semibold">Apparence</h2><p className="mt-2 text-sm text-muted">Votre choix est mémorisé sur cet appareil.</p><div className="mt-5 flex flex-wrap gap-3"><button className={SECONDARY} onClick={() => setTheme("light")} data-testid="settings-light"><Sun size={17} /> Thème clair</button><button className={SECONDARY} onClick={() => setTheme("dark")} data-testid="settings-dark"><Moon size={17} /> Thème sombre</button></div></section><section className={cn(CARD, "p-6")}><h2 className="font-semibold">Session</h2><p className="mt-2 text-sm text-muted">Déconnectez-vous lorsque vous avez terminé sur un appareil partagé.</p><button className={cn(SECONDARY, "mt-5")} data-testid="workspace-logout" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}><LogOut size={17} />{logout.isPending ? "Déconnexion…" : "Se déconnecter"}</button>{logout.isError && <p role="alert" className="mt-3 text-sm text-warning">{logout.error.message}</p>}</section></main>;
}
