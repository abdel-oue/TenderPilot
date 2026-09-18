"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { useLogin, useLogout, useMe, useSignup } from "@/hooks/useAuth";
import { AuthField } from "./authField";
import { Reveal } from "@/components/ui/reveal";
import { PRIMARY, SECONDARY } from "@/lib/utils/workspaceStyleUtils";
import { validateAuth, type AuthMode, type AuthErrors } from "@/lib/utils/authUtils";
interface AuthPanelProps { mode?: AuthMode }
export function AuthPanel({ mode = "login" }: AuthPanelProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AuthErrors>({});
  const router = useRouter();
  const me = useMe();
  const login = useLogin();
  const signup = useSignup();
  const logout = useLogout();
  const mutation = mode === "login" ? login : signup;
  const isSignup = mode === "signup";
  function submit() {
    if (mutation.isPending) return;
    const input = { name: name.trim(), email: email.trim(), password };
    const nextErrors = validateAuth(mode, input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (isSignup) signup.mutate(input, { onSuccess: () => router.replace("/company") });
    else login.mutate(input, { onSuccess: () => router.replace("/dashboard") });
  }
  if (me.isPending) return <div className="h-96 animate-pulse rounded-2xl bg-soft" data-testid="auth-loading" aria-label="Chargement de la session" />;
  if (me.data) return (
    <Reveal className="space-y-5">
      <div data-testid="auth-signed-in"><h1 className="font-heading text-4xl">Heureux de vous retrouver.</h1><p className="mt-4 text-sm text-muted">Vous êtes connecté avec {me.data.email}.</p></div>
      <Link href="/dashboard" className={PRIMARY} data-testid="auth-open-app">Ouvrir mon tableau de bord <ArrowRight size={17} /></Link>
      <button className={SECONDARY} disabled={logout.isPending} onClick={() => logout.mutate()} data-testid="auth-logout">{logout.isPending ? "Déconnexion…" : "Changer de compte"}</button>
      {logout.isError && <p role="alert" className="text-sm text-warning">{logout.error.message}</p>}
    </Reveal>
  );
  return (
    <Reveal>
      <div data-testid="auth-panel" className="space-y-7">
        <div><p className="mb-3 text-xs font-semibold tracking-label text-accent uppercase">Votre prochain marché commence ici</p><h1 className="font-heading text-4xl tracking-tight md:text-5xl">{isSignup ? "Faisons connaissance." : "Content de vous revoir."}</h1><p className="mt-4 text-sm leading-6 text-muted">{isSignup ? "Créez votre espace et donnez une longueur d’avance à votre entreprise." : "Retrouvez vos dossiers, vos analyses et vos prochaines opportunités."}</p></div>
        <div className="space-y-5" role="group" aria-label={isSignup ? "Inscription" : "Connexion"} onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); submit(); } }}>
          {isSignup && <AuthField label="Nom complet" type="text" value={name} onChange={setName} autoComplete="name" testid="auth-name" placeholder="Votre nom et prénom" error={errors.name} disabled={mutation.isPending} />}
          <AuthField label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" testid="auth-email" placeholder="vous@entreprise.ma" error={errors.email} disabled={mutation.isPending} />
          <AuthField label="Mot de passe" type="password" value={password} onChange={setPassword} autoComplete={isSignup ? "new-password" : "current-password"} testid="auth-password" placeholder={isSignup ? "8 caractères minimum" : "Votre mot de passe"} error={errors.password} disabled={mutation.isPending} />
          {isSignup && <p className="text-xs leading-5 text-muted">Un compte, un espace dédié à votre entreprise. Vous pourrez compléter votre profil après l’inscription.</p>}
          {mutation.isError && <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning" data-testid="auth-error" role="alert">{mutation.error.message}</p>}
          {me.isError && <div className="rounded-xl bg-warning-soft p-3 text-sm text-warning" role="alert" data-testid="auth-session-error">Connexion au service indisponible. <button className="cursor-pointer underline" onClick={() => void me.refetch()}>Réessayer</button></div>}
          <button className={`${PRIMARY} w-full`} onClick={submit} disabled={mutation.isPending} data-testid="auth-submit">{mutation.isPending && <Loader2 className="animate-spin" size={18} />}{mutation.isPending ? "Un instant…" : isSignup ? "Créer mon compte" : "Se connecter"}{!mutation.isPending && <ArrowRight size={18} />}</button>
        </div>
        <p className="text-center text-sm text-muted">{isSignup ? "Déjà un compte ? " : "Vous découvrez TenderPilot ? "}<Link className="font-semibold text-accent underline-offset-4 hover:underline" href={isSignup ? "/login" : "/signup"} data-testid={isSignup ? "auth-tab-login" : "auth-tab-signup"}>{isSignup ? "Se connecter" : "Créer un compte"}</Link></p>
        <p className="flex items-center justify-center gap-2 border-t border-border pt-6 text-xs text-muted"><LockKeyhole size={14} /> Un espace privé pour vos appels d’offres.</p>
      </div>
    </Reveal>
  );
}