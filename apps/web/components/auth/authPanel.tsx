"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLogin, useLogout, useMe, useSignup } from "@/hooks/useAuth";
import { cn } from "@/lib/utils/classNameUtils";
import Link from "next/link";

type Mode = "login" | "signup";

const TAB = "flex-1 cursor-pointer rounded-md px-4 py-2.5 text-tiny font-semibold text-muted transition duration-200 hover:text-foreground";
const TAB_ACTIVE = "bg-surface text-foreground";
const INPUT = "w-full rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition duration-200 focus:border-accent";
const SUBMIT = "mt-2 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-6 py-3 text-sm font-semibold text-background transition duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const ALERT = "rounded-md border border-border bg-warning-soft px-4 py-3 text-tiny text-warning";

interface FieldProps {
  label: string;
  type: string;
  value: string;
  autoComplete: string;
  testid: string;
  onChange: (value: string) => void;
}

function Field({ label, type, value, autoComplete, testid, onChange }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-mini font-semibold tracking-wide text-muted uppercase">{label}</span>
      <input
        className={INPUT}
        type={type}
        value={value}
        autoComplete={autoComplete}
        data-testid={testid}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const me = useMe();
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const logoutMutation = useLogout();
  const mutation = mode === "login" ? loginMutation : signupMutation;

  function submit() {
    if (mode === "login") loginMutation.mutate({ email, password });
    else signupMutation.mutate({ name, email, password });
  }

  function switchTo(next: Mode) {
    setMode(next);
    loginMutation.reset();
    signupMutation.reset();
  }

  if (me.isLoading) {
    return <div className="h-80 w-full animate-pulse rounded-lg bg-soft" data-testid="auth-loading" />;
  }

  if (me.data) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-8" data-testid="auth-signed-in">
        <p className="font-heading text-2xl">Bonjour {me.data.name}.</p>
        <p className="text-sm text-muted">Vous êtes connecté avec {me.data.email}.</p>
        <Link className={SUBMIT} href="/tenders" data-testid="auth-open-app">
          Ouvrir mes dossiers
        </Link>
        <button className={SUBMIT} onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} data-testid="auth-logout">
          {logoutMutation.isPending && <Loader2 size={16} className="animate-spin" />}
          Se déconnecter
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-background p-8" data-testid="auth-panel">
      <div className="flex gap-1 rounded-lg bg-soft p-1">
        <button className={cn(TAB, mode === "login" && TAB_ACTIVE)} onClick={() => switchTo("login")} data-testid="auth-tab-login">
          Se connecter
        </button>
        <button className={cn(TAB, mode === "signup" && TAB_ACTIVE)} onClick={() => switchTo("signup")} data-testid="auth-tab-signup">
          Créer un compte
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {mode === "signup" && (
          <Field label="Nom" type="text" value={name} autoComplete="name" testid="auth-name" onChange={setName} />
        )}
        <Field label="E-mail" type="email" value={email} autoComplete="email" testid="auth-email" onChange={setEmail} />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          testid="auth-password"
          onChange={setPassword}
        />

        {mutation.isError && (
          <p className={ALERT} data-testid="auth-error" role="alert">{mutation.error.message}</p>
        )}
        {me.isError && !mutation.isError && (
          <p className={ALERT} data-testid="auth-session-error" role="alert">Session indisponible. Réessayez dans un instant.</p>
        )}

        <button className={SUBMIT} onClick={submit} disabled={mutation.isPending} data-testid="auth-submit">
          {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
          {mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </div>
    </div>
  );
}
