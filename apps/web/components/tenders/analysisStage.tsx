"use client";
// The centre of the analysis screen, in its three states.
//
//   idle     the button, alone, centred — there is one thing to do here
//   running  the button is replaced in place by the agent's reasoning
//   done     the reasoning collapses to one line and the verdict takes the space
//
// One column, three phases, and the transition between them is the point: the
// button does not vanish and a panel appear somewhere else, the thing you
// pressed becomes the thing you are watching.
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Play, RotateCw } from "lucide-react";
import type { Blocker } from "@tenderpilot/shared";
import type { AnalysisEnvelope, HumanAnswer, RunEvent } from "@/lib/types";
import { VerdictBadge } from "@/components/ui/verdictBadge";
import { exportDocxUrl } from "@/lib/api/analysis";
import { formatConfidence, formatScore } from "@/lib/utils/formatUtils";
import { totalDuration } from "@/lib/utils/traceUtils";
import { fadeUp, popIn } from "@/lib/utils/motionUtils";
import { PRIMARY, SECONDARY } from "@/lib/utils/workspaceStyleUtils";
import { cn } from "@/lib/utils/classNameUtils";
import { ThinkingFeed } from "./thinkingFeed";
import { HumanQuestion } from "./humanQuestion";
import { DecisionReview } from "./decisionReview";

const STATUS_LABELS: Record<string, string> = {
  queued: "En file d’attente",
  running: "Analyse en cours",
  awaiting_human: "En attente de votre réponse",
  done: "Analyse terminée",
  failed: "Analyse échouée",
};

interface AnalysisStageProps {
  reference: string;
  analysis: AnalysisEnvelope | null;
  liveTools: Extract<RunEvent, { type: "tool" }>[];
  starting: boolean;
  startError: string | null;
  onStart: () => void;
  answering: boolean;
  answerError: string | null;
  onAnswer: (answer: HumanAnswer) => void;
}

export function AnalysisStage({
  reference,
  analysis,
  liveTools,
  starting,
  startError,
  onStart,
  answering,
  answerError,
  onAnswer,
}: AnalysisStageProps) {
  const reduced = useReducedMotion();
  const status = analysis?.status;
  const queued = status === "queued";
  const running = status === "running";
  const waiting = status === "awaiting_human";
  const result = analysis?.result ?? null;
  const trace = analysis?.nodeTrace ?? [];

  // One phase renders at a time, and each renders exactly one analyze-button:
  // two in the DOM at once is a strict-mode failure in the browser tests and an
  // ambiguous screen for everyone else.
  const phase =
    queued || running || waiting ? "working" : status === "failed" ? "failed" : result ? "done" : "idle";

  // Open by default while the agent works, closed once it is done — but the
  // reader's own toggle wins until the phase changes under them. Reset during
  // render, not in an effect: an effect would show the wrong state for a frame.
  const [override, setOverride] = useState<boolean | null>(null);
  const [lastPhase, setLastPhase] = useState(phase);
  if (phase !== lastPhase) {
    setLastPhase(phase);
    setOverride(null);
  }
  const expanded = override ?? phase === "working";
  const toggle = () => setOverride(!expanded);
  const blockers: Blocker[] = result?.blockers ?? [];

  return (
    <section className="flex flex-col items-center gap-5 py-6 text-center" data-testid="analysis-stage">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-3xl tracking-tight">{reference}</h1>
        <span data-testid="analysis-status" className="text-mini uppercase tracking-label text-muted">
          {status ? STATUS_LABELS[status] : "aucune analyse"}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "idle" && (
          <motion.div
            key="idle"
            variants={fadeUp(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col items-center gap-3"
          >
            <button
              className={cn(PRIMARY, "min-h-12 px-6 text-sm")}
              data-testid="analyze-button"
              disabled={starting}
              onClick={onStart}
            >
              <Play size={16} />
              {starting ? "Lancement…" : "Analyser ce dossier"}
            </button>
            <p className="max-w-sm text-xs leading-5 text-muted">
              L&apos;agent lit chaque pièce, en extrait les exigences et les confronte à votre
              profil. Vous verrez son raisonnement pendant qu&apos;il travaille.
            </p>
          </motion.div>
        )}

        {phase === "working" && (
          <motion.div
            key="working"
            variants={fadeUp(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-3xl space-y-4"
          >
            {queued ? <p role="status" data-testid="analysis-queued" className="text-sm text-muted">Ce dossier est en file d’attente. L’analyse démarrera dès qu’un agent sera disponible.</p> : null}
            {waiting && analysis?.pendingQuestion ? (
              <HumanQuestion
                question={analysis.pendingQuestion}
                blockers={blockers}
                pending={answering}
                error={answerError}
                onAnswer={onAnswer}
              />
            ) : null}
            <ThinkingFeed
              trace={trace}
              liveTools={liveTools}
              running={running}
              expanded={expanded}
              onToggle={toggle}
            />
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="done"
            variants={fadeUp(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-3xl space-y-5"
          >
            <motion.div variants={popIn(reduced)} initial="hidden" animate="visible">
              {result ? <VerdictBadge verdict={result.verdict} /> : null}
            </motion.div>

            {result ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  Score {formatScore(result.score)} · confiance{" "}
                  {formatConfidence(result.confidence)}
                  {totalDuration(trace) ? ` · analysé en ${totalDuration(trace)}` : ""}
                </p>
                <p data-testid="verdict-justification" className="mx-auto max-w-2xl text-sm leading-6">
                  {result.justification}
                </p>
                {result.needsHuman ? (
                  <div data-testid="analysis-warnings" role="status" className="rounded border border-border bg-warning-soft p-3 text-left text-sm">
                    <p>Vérification humaine requise avant utilisation du dossier.</p>
                    {(result.stageErrors ?? []).map((error, index) => <p key={index}>{error.message}</p>)}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button className={SECONDARY} data-testid="analyze-button" disabled={starting} onClick={onStart}>
                <RotateCw size={15} />
                {starting ? "Lancement…" : "Relancer l’analyse"}
              </button>
              {analysis && analysis.sections.length > 0 ? (
                <a className={SECONDARY} data-testid="export-docx" href={exportDocxUrl(analysis.runId)}>
                  Exporter en DOCX
                </a>
              ) : null}
            </div>

            {analysis ? <DecisionReview tenderId={analysis.tenderId} runId={analysis.runId} blockers={blockers} /> : null}

            <ThinkingFeed
              trace={trace}
              liveTools={liveTools}
              running={false}
              expanded={expanded}
              onToggle={toggle}
            />
          </motion.div>
        )}
        {/* A failure is shown, never swallowed, and the trace stays: how far it
            got is the useful part. */}
        {phase === "failed" && (
          <motion.div
            key="failed"
            variants={fadeUp(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-3xl space-y-4"
          >
            <p data-testid="analysis-failed" className="text-sm text-no-go">
              L&apos;analyse a échoué : {analysis?.error}
            </p>
            <button
              className={cn(PRIMARY, "min-h-12 px-6 text-sm")}
              data-testid="analyze-button"
              disabled={starting}
              onClick={onStart}
            >
              <RotateCw size={16} />
              {starting ? "Lancement…" : "Relancer l’analyse"}
            </button>
            <ThinkingFeed
              trace={trace}
              liveTools={liveTools}
              running={false}
              expanded={expanded}
              onToggle={toggle}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {startError ? <p className="text-sm text-no-go">{startError}</p> : null}
    </section>
  );
}
