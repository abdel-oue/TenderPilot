import { Activity, Clock, Coins, Route } from "lucide-react";
import { CARD } from "@/lib/utils/workspaceStyleUtils";
import { cn } from "@/lib/utils/classNameUtils";
export const metadata = { title: "Contrôle — TenderPilot" };
// Nothing to plot yet: the graph trace carries node, at, summary and status, and
// no token count or duration. This page names what it will show once it does.
const PLANNED = [
  { label: "Raisonnement", description: "Ce que chaque agent a décidé, et sur quel passage il s’appuie.", icon: Route },
  { label: "Jetons consommés", description: "Par nœud et par analyse, entrée et sortie séparées.", icon: Coins },
  { label: "Temps passé", description: "Durée de chaque nœud du graphe et de l’analyse complète.", icon: Clock },
];
export default function Page() {
  return <main className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-10 pt-2 md:px-7" data-testid="controle">
    <header><h1 className="font-heading text-2xl tracking-tight">Contrôle</h1><p className="mt-1 text-xs text-muted">Ce que l’IA a fait, ce qu’elle a coûté, le temps qu’elle a pris.</p></header>
    <div className="grid gap-3 md:grid-cols-3">{PLANNED.map((item) => <section key={item.label} className={cn(CARD, "p-4")}><item.icon size={16} strokeWidth={1.7} className="text-accent" /><h2 className="mt-2.5 text-sm font-semibold">{item.label}</h2><p className="mt-1 text-mini leading-5 text-muted">{item.description}</p></section>)}</div>
    <p className="flex items-center gap-2 text-mini text-muted"><Activity size={13} /> La trace du graphe n’enregistre pas encore les jetons ni les durées : cette page les affichera dès que les nœuds les remonteront.</p>
  </main>;
}
