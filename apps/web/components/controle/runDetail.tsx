"use client";
// One run, opened: every node it ran, every tool it called, every token it spent.
//
// Nothing here is new data. The trace has carried `ms` and the tool narration
// since the graph wrote its first row, and llm_usage has carried tokens per
// agent per run since the first call — this screen is the first thing to read them.
import { AlertTriangle, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRunDetail } from "@/hooks/useRuns";
import { nodePhrase } from "@/lib/utils/traceUtils";
import { formatDuration } from "@/lib/utils/formatUtils";
import { cn } from "@/lib/utils/classNameUtils";

interface RunDetailProps { runId: string }

const STATUS_TONE: Record<string, string> = {
  ok: "text-positive",
  error: "text-no-go",
  retry: "text-warning",
  human: "text-accent",
};

export function RunDetail({ runId }: RunDetailProps) {
  const detail = useRunDetail(runId);

  if (detail.isPending) return <div className="space-y-2 p-4"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-24 w-full" /></div>;
  if (detail.isError) return <p role="alert" data-testid="run-detail-error" className="p-4 text-sm text-no-go">{detail.error.message}</p>;

  const { nodeTrace, usage, error } = detail.data;
  const totalTokens = usage.reduce((sum, row) => sum + row.totalTokens, 0);

  return <div data-testid="run-detail" className="space-y-6 border-t border-border bg-background/40 p-4 md:p-5">
    {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</p>}

    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-label text-muted">Raisonnement</h3>
      {nodeTrace.length ? <ol className="space-y-2">{nodeTrace.map((entry, index) => <li key={`${entry.node}-${entry.at}-${index}`} data-testid="run-trace-entry" className="rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{entry.status === "human" ? "Réponse de l’humain" : nodePhrase(entry.node).replace("…", "")}</p>
          <span className={cn("text-mini", STATUS_TONE[entry.status] ?? "text-muted")}>{entry.status}{entry.ms ? ` · ${formatDuration(entry.ms)}` : ""}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">{entry.summary}</p>
        {entry.status === "human" && entry.choiceLabel && <p className="mt-2 flex items-center gap-2 text-xs text-accent"><MessageSquare size={13} />{entry.choiceLabel}{entry.instruction ? ` — ${entry.instruction}` : ""}</p>}
        {entry.tools?.length ? <ul className="mt-2 space-y-1 border-t border-border pt-2">{entry.tools.map((tool, position) => <li key={`${tool.name}-${position}`} data-testid="run-trace-tool" className="text-mini leading-5 text-muted">
          <span className="font-medium text-foreground">{tool.name}</span>{tool.raison ? ` · ${tool.raison}` : ""} → {tool.outcome}
        </li>)}</ul> : null}
      </li>)}</ol> : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">Cette analyse n’a encore écrit aucune étape.</p>}
    </section>

    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-label text-muted">Jetons par agent</h3>
      {usage.length ? <div className="overflow-x-auto rounded-xl border border-border bg-surface"><table data-testid="run-usage" className="w-full min-w-150 text-left text-sm"><thead><tr className="border-b border-border text-mini text-muted">
        <th scope="col" className="px-3 py-2 font-medium">Agent</th>
        <th scope="col" className="px-3 py-2 font-medium">Modèle</th>
        <th scope="col" className="px-3 py-2 font-medium">Appels</th>
        <th scope="col" className="px-3 py-2 font-medium">Entrée</th>
        <th scope="col" className="px-3 py-2 font-medium">Sortie</th>
        <th scope="col" className="px-3 py-2 font-medium">Total</th>
        <th scope="col" className="px-3 py-2 font-medium">Latence moy.</th>
      </tr></thead><tbody>{usage.map((row) => <tr key={`${row.operation}-${row.tier}`} data-testid="run-usage-row" className="border-b border-border last:border-0">
        <td className="px-3 py-2 font-medium">{row.operation}{row.errors > 0 && <span className="ml-2 text-mini text-no-go">{row.errors} erreur{row.errors > 1 ? "s" : ""}</span>}</td>
        <td className="px-3 py-2 text-mini text-muted">{row.model}</td>
        <td className="px-3 py-2">{row.calls}</td>
        <td className="px-3 py-2 text-muted">{row.promptTokens.toLocaleString("fr-FR")}</td>
        <td className="px-3 py-2 text-muted">{row.completionTokens.toLocaleString("fr-FR")}</td>
        <td className="px-3 py-2 font-medium">{row.totalTokens.toLocaleString("fr-FR")}</td>
        <td className="px-3 py-2 text-mini text-muted">{formatDuration(row.avgLatencyMs)}</td>
      </tr>)}</tbody><tfoot><tr><td className="px-3 py-2 text-mini text-muted" colSpan={5}>Total de l’analyse</td><td className="px-3 py-2 text-sm font-medium" colSpan={2}>{totalTokens.toLocaleString("fr-FR")} jetons</td></tr></tfoot></table></div>
        : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">Aucun appel au modèle enregistré pour cette analyse.</p>}
    </section>
  </div>;
}
