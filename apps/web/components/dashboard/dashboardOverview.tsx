"use client";
import { useMe } from "@/hooks/useAuth";
import { useTenders } from "@/hooks/useTenders";
import { DashboardStats } from "./dashboardStats";
import { DashboardInsights } from "./dashboardInsights";
import { TenderTable } from "./tenderTable";
import { DataFeedback } from "./dataFeedback";
export function DashboardOverview() {
  const me = useMe();
  const tenders = useTenders();
  return <main className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-10 pt-2 md:px-7" data-testid="dashboard">
    <header><div><h1 className="font-heading text-2xl tracking-tight">Bonjour, {me.data?.name.split(" ")[0] ?? "vous"}<span className="text-accent">.</span></h1><p className="mt-1 text-xs text-muted">Une vue claire sur vos dossiers. Une décision à la fois.</p></div></header>
    <DataFeedback pending={tenders.isPending} error={tenders.error} retry={() => void tenders.refetch()} />
    {tenders.data && !tenders.isError && <><DashboardStats tenders={tenders.data} /><div className="grid items-start gap-4 xl:grid-cols-3"><div className="min-w-0 space-y-4 xl:col-span-2"><TenderTable tenders={tenders.data} compact /><p className="px-1 text-mini leading-5 text-muted">Les recommandations vous accompagnent. La décision finale reste la vôtre.</p></div><DashboardInsights tenders={tenders.data} /></div></>}
  </main>;
}
