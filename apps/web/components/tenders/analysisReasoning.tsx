// How the agent got to the verdict, not just what it decided.
//
// Two things the api has always returned and the screen threw away: the score's
// own derivation (the rubric the agent parsed out of the dossier, criterion by
// criterion) and the risks it flagged but refused to turn into a disqualification.
// A score of 50/100 with no breakdown is a number the reader has to trust; with
// the breakdown it is a number they can check.
import type { AnalysisResult } from "@/lib/types";

interface AnalysisReasoningProps {
  result: AnalysisResult;
}

export default function AnalysisReasoning({ result }: AnalysisReasoningProps) {
  const total = result.rubricBreakdown.reduce((sum, row) => sum + row.maxPoints, 0);
  const earned = result.rubricBreakdown.reduce((sum, row) => sum + row.points, 0);

  if (result.rubricBreakdown.length === 0 && result.warnings.length === 0) return null;

  return (
    <div data-testid="analysis-reasoning" className="space-y-6">
      {result.rubricBreakdown.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Détail de la notation
          </h2>
          <ul data-testid="rubric-breakdown" className="space-y-2">
            {result.rubricBreakdown.map((row) => (
              <li
                key={row.label}
                data-testid="rubric-criterion"
                className="flex items-baseline justify-between gap-4 border-b border-border pb-2 text-sm"
              >
                <span>{row.label}</span>
                <span className="shrink-0 text-muted">
                  {row.points} / {row.maxPoints}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-mini text-muted">
            {earned} / {total} points projetés — projection fondée sur la couverture des
            exigences, pas une note réelle du jury.
          </p>
        </section>
      ) : null}

      {/* A risk the agent saw and deliberately did NOT promote to a blocker.
          Hiding it would make that restraint look like an oversight. */}
      {result.warnings.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Risques signalés</h2>
          <ul className="space-y-2">
            {result.warnings.map((warning) => (
              <li
                key={warning.label}
                data-testid="analysis-warning"
                className="rounded-md border border-border bg-soft p-3 text-sm"
              >
                <p>{warning.text}</p>
                <p className="mt-1 text-mini text-muted">{warning.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
