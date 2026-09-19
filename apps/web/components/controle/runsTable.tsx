"use client";
// Every analysis ever launched, newest first. Until this screen existed, a run
// was only reachable from its dossier, and only the latest one — the previous
// attempts were in the database and nowhere else.
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRuns } from "@/hooks/useRuns";
import { formatDate, formatDateTime, formatDuration } from "@/lib/utils/formatUtils";
import { cn } from "@/lib/utils/classNameUtils";
import { RunDetail } from "./runDetail";

const STATUS_LABEL: Record<string, string> = {
  queued: "En file",
  running: "En cours",
  awaiting_human: "Attend une réponse",
  done: "Terminée",
  failed: "Échouée",
};
const STATUS_TONE: Record<string, string> = {
  done: "bg-accent-soft text-accent",
  failed: "bg-warning-soft text-warning",
  awaiting_human: "bg-warning-soft text-warning",
};

export function RunsTable() {
  const runs = useRuns();
  const [openRun, setOpenRun] = useState<string | null>(null);

  if (runs.isPending) return <div className="space-y-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-16 w-full" />)}</div>;
  if (runs.isError) return <p role="alert" data-testid="runs-error" className="rounded-2xl border border-border bg-surface p-5 text-sm text-no-go">{runs.error.message}</p>;
  if (runs.data.length === 0) return <p data-testid="runs-empty" className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">Aucune analyse lancée pour l’instant. Ouvrez un dossier et lancez-en une : elle apparaîtra ici avec son raisonnement et ses jetons.</p>;

  return <ul data-testid="runs-table" className="space-y-2">{runs.data.map((run) => {
    const open = openRun === run.runId;
    return <li key={run.runId} className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left" aria-expanded={open} data-testid="run-row" onClick={() => setOpenRun(open ? null : run.runId)}>
          <ChevronDown size={16} className={cn("shrink-0 text-muted transition duration-200", open && "rotate-180")} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{run.reference}{run.title ? <span className="font-normal text-muted"> · {run.title}</span> : null}</span>
            <span className="mt-1 block text-mini text-muted">{formatDate(run.startedAt)} à {formatDateTime(run.startedAt)} · {run.steps} étape{run.steps > 1 ? "s" : ""} · {run.calls} appel{run.calls > 1 ? "s" : ""} · {run.graphVersion}</span>
          </span>
        </button>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-mini", STATUS_TONE[run.status] ?? "bg-soft text-muted")}>{STATUS_LABEL[run.status] ?? run.status}</span>
        <span className="shrink-0 text-mini text-muted">{run.durationMs === null ? "—" : formatDuration(run.durationMs)}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums">{run.totalTokens.toLocaleString("fr-FR")}<span className="ml-1 text-mini font-normal text-muted">jetons</span></span>
        <Link href={`/tenders/${run.tenderId}`} className="shrink-0 rounded-lg p-2 text-muted hover:bg-soft" aria-label={`Ouvrir le dossier ${run.reference}`} data-testid="run-open-tender"><ExternalLink size={15} /></Link>
      </div>
      {open && <RunDetail runId={run.runId} />}
    </li>;
  })}</ul>;
}
