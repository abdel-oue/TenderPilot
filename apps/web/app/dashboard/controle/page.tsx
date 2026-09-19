import { RunsTable } from "@/components/controle/runsTable";
export const metadata = { title: "Contrôle — TenderPilot" };
export default function Page() {
  return <main className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-10 pt-2 md:px-7" data-testid="controle">
    <header><h1 className="font-heading text-2xl tracking-tight">Contrôle</h1><p className="mt-1 text-xs text-muted">Ce que l’IA a fait, ce qu’elle a coûté, le temps qu’elle a pris. Ouvrez une analyse pour voir chaque étape et les jetons de chaque agent.</p></header>
    <RunsTable />
  </main>;
}
