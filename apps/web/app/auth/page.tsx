import Link from "next/link";
import { AuthPanel } from "@/components/auth/authPanel";
import { Container } from "@/components/ui/container";

export const metadata = { title: "TenderPilot — Connexion" };

export default function AuthPage() {
  return (
    <main className="flex min-h-screen items-center py-20" id="main">
      <Container className="mx-auto flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col gap-3 text-center">
          <Link href="/" className="text-mini font-semibold tracking-wide text-muted uppercase hover:text-foreground">
            TenderPilot
          </Link>
          <h1 className="font-heading text-4xl">Votre espace de travail.</h1>
          <p className="text-sm text-muted">Connectez-vous pour retrouver vos dossiers et vos analyses.</p>
        </div>
        <AuthPanel />
      </Container>
    </main>
  );
}
