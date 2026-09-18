"use client";
// EX-04: the verdict, its justification, and the trigger to (re)run the analysis.
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/ui/verdictBadge";
import { exportDocxUrl } from "@/lib/api/analysis";
import { useStartAnalysis } from "@/hooks/useAnalysis";
import { formatConfidence, formatScore } from "@/lib/utils/formatUtils";
import type { AnalysisEnvelope } from "@/lib/types";

interface VerdictHeaderProps {
  tenderId: string;
  reference: string;
  analysis: AnalysisEnvelope | null;
}

export default function VerdictHeader({ tenderId, reference, analysis }: VerdictHeaderProps) {
  const start = useStartAnalysis(tenderId);
  const running = analysis?.status === "queued" || analysis?.status === "running";
  const result = analysis?.result ?? null;
  // Nothing is drafted for a no-go, so there is nothing to export either.
  const exportable = analysis && analysis.sections.length > 0;

  return (
    <header className="space-y-4 rounded-md border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="font-heading text-3xl">{reference}</h1>
          {result ? <VerdictBadge verdict={result.verdict} /> : null}
        </div>

        <div className="flex items-center gap-3">
          <Button
            data-testid="analyze-button"
            variant="primary"
            onClick={() => start.mutate()}
          >
            {running ? "Analyse en cours…" : start.isPending ? "Lancement…" : "Analyser"}
          </Button>
          {exportable ? (
            <Button data-testid="export-docx" href={exportDocxUrl(analysis.runId)}>
              Exporter en DOCX
            </Button>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            Score {formatScore(result.score)} · confiance {formatConfidence(result.confidence)}
          </p>
          <p data-testid="verdict-justification" className="text-sm">
            {result.justification}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {running
            ? "L'agent lit le dossier. Les étapes s'affichent en direct plus bas."
            : "Aucune analyse pour ce dossier."}
        </p>
      )}

      {/* The failure is shown, never swallowed. */}
      {analysis?.status === "failed" ? (
        <p data-testid="analysis-failed" className="text-sm text-no-go">
          L&apos;analyse a échoué : {analysis.error}
        </p>
      ) : null}
      {start.isError ? (
        <p className="text-sm text-no-go">{(start.error as Error).message}</p>
      ) : null}
    </header>
  );
}
