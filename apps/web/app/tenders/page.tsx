// Dossier list + deposit. Server Component shell, client children for the
// interactive parts.
import Link from "next/link";
import NewDossierPanel from "@/components/tenders/newDossierPanel";
import TenderList from "@/components/tenders/tenderList";

export const metadata = { title: "Dossiers — TenderPilot" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 p-8">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl">Dossiers</h1>
          <p className="text-sm text-muted">
            Déposez un avis en PDF, lancez l&apos;analyse, tranchez le go / no-go.
          </p>
        </div>
        <Link className="cursor-pointer text-sm underline underline-offset-2" href="/company">
          Mon entreprise
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Nouveau dossier</h2>
        <NewDossierPanel />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Tous les dossiers</h2>
        <TenderList />
      </section>
    </main>
  );
}
