import { AlertCircle, RotateCw } from "lucide-react";
import { SECONDARY } from "@/lib/utils/workspaceStyleUtils";
interface DataFeedbackProps { pending: boolean; error: Error | null; retry: () => void }
export function DataFeedback({ pending, error, retry }: DataFeedbackProps) {
  if (pending) return <div className="space-y-4" aria-label="Chargement des dossiers" data-testid="data-loading"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((key) => <div key={key} className="h-24 animate-pulse rounded-2xl bg-soft" />)}</div><div className="h-64 animate-pulse rounded-2xl bg-soft" /></div>;
  if (error) return <div className="rounded-2xl border border-border bg-surface p-8" role="alert" data-testid="data-error"><AlertCircle className="text-warning" size={25} /><h2 className="mt-4 font-semibold">Impossible de charger vos dossiers</h2><p className="my-3 text-sm text-muted">{error.message}</p><button className={SECONDARY} onClick={retry} data-testid="data-retry"><RotateCw size={16} /> Réessayer</button></div>;
  return null;
}
