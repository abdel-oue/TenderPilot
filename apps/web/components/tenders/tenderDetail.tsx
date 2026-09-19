"use client";
// The review screen.
//
// The centre column is the analysis itself: press the button, watch the agent,
// read the verdict. Everything the verdict is BUILT from — the blockers, the
// matrix, the mémoire — sits on the right as three cards that open a panel.
// That ordering is the EX-04 user story: decide first, check the evidence when
// you want to argue with it.
import { useState } from "react";
import { AlertTriangle, FileText, Table2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideOver } from "@/components/ui/slideOver";
import AnalysisReasoning from "./analysisReasoning";
import BlockerList from "./blockerList";
import ComplianceMatrix from "./complianceMatrix";
import SectionEditor from "./sectionEditor";
import UnreadPagesBanner from "./unreadPagesBanner";
import { AnalysisStage } from "./analysisStage";
import { useAnalysis, useAnswerQuestion, useStartAnalysis } from "@/hooks/useAnalysis";
import { useRunStream } from "@/hooks/useRunStream";
import { useRequirements, useTender } from "@/hooks/useTenders";
import { CARD } from "@/lib/utils/workspaceStyleUtils";
import { fadeUp, stagger } from "@/lib/utils/motionUtils";
import { cn } from "@/lib/utils/classNameUtils";

interface TenderDetailProps {
  tenderId: string;
}

type PanelKey = "blockers" | "matrix" | "memo";

export default function TenderDetail({ tenderId }: TenderDetailProps) {
  const tender = useTender(tenderId);
  const analysis = useAnalysis(tenderId);
  const requirements = useRequirements(tenderId);
  const start = useStartAnalysis(tenderId);
  const answer = useAnswerQuestion(tenderId, analysis.data?.runId);
  const liveTools = useRunStream(tenderId, analysis.data?.runId, analysis.data?.status);
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<PanelKey | null>(null);

  if (tender.isPending) return <Skeleton className="h-96 w-full" />;
  if (tender.isError) {
    return (
      <p data-testid="tender-error" className="text-sm text-no-go">
        {(tender.error as Error).message}
      </p>
    );
  }

  const envelope = analysis.data ?? null;
  const result = envelope?.result ?? null;

  const panels: { key: PanelKey; label: string; count: string; icon: typeof AlertTriangle }[] = [
    {
      key: "blockers",
      label: "Points bloquants",
      count: result ? `${result.blockers.length}` : "—",
      icon: AlertTriangle,
    },
    {
      key: "matrix",
      label: "Matrice de conformité",
      count: requirements.data ? `${requirements.data.length}` : "—",
      icon: Table2,
    },
    {
      key: "memo",
      label: "Mémoire technique",
      count: envelope ? `${envelope.sections.length}` : "—",
      icon: FileText,
    },
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_17rem]">
      <div className="min-w-0 space-y-5">
        <AnalysisStage
          reference={tender.data.reference}
          analysis={envelope}
          liveTools={liveTools}
          starting={start.isPending}
          startError={start.isError ? (start.error as Error).message : null}
          onStart={() => start.mutate()}
          answering={answer.isPending}
          answerError={answer.isError ? (answer.error as Error).message : null}
          onAnswer={(payload) => answer.mutate(payload)}
        />

        {/* EX-07: what was not read changes how much the rest is worth, so it
            sits with the verdict rather than behind a panel. */}
        {result ? <UnreadPagesBanner unreadPages={result.unreadPages} /> : null}
      </div>

      <motion.aside
        className="space-y-2 lg:sticky lg:top-20"
        variants={stagger(reduced)}
        initial="hidden"
        animate="visible"
        aria-label="Détail de l’analyse"
      >
        {panels.map((item) => (
          <motion.button
            key={item.key}
            variants={fadeUp(reduced, 8)}
            className={cn(
              CARD,
              "group flex w-full cursor-pointer items-center gap-3 p-3.5 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={!envelope}
            data-testid={`panel-${item.key}`}
            onClick={() => setPanel(item.key)}
          >
            <span className="shrink-0 rounded-lg bg-soft p-2 text-accent">
              <item.icon size={16} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{item.label}</span>
              <span className="block text-mini text-muted">
                {envelope ? `${item.count} élément(s)` : "Lancez l’analyse"}
              </span>
            </span>
          </motion.button>
        ))}

        {/* The verdict's own derivation. Short enough to read in place — putting
            it behind a fourth panel would hide the reasoning the score rests on. */}
        {result ? <AnalysisReasoning result={result} /> : null}
      </motion.aside>

      <SlideOver
        open={panel === "blockers"}
        title="Points bloquants"
        subtitle="Une capacité exigée que l’entreprise ne démontre pas. Chaque point cite sa page."
        testId="slideover-blockers"
        onClose={() => setPanel(null)}
      >
        {result ? (
          <BlockerList blockers={result.blockers} />
        ) : (
          <p className="text-sm text-muted">Lancez l&apos;analyse pour les obtenir.</p>
        )}
      </SlideOver>

      <SlideOver
        open={panel === "matrix"}
        title="Matrice de conformité"
        subtitle="Chaque exigence, sa source, et la raison pour laquelle le profil la couvre ou non."
        testId="slideover-matrix"
        onClose={() => setPanel(null)}
      >
        <ComplianceMatrix tenderId={tenderId} />
      </SlideOver>

      <SlideOver
        open={panel === "memo"}
        title="Mémoire technique"
        subtitle="Le brouillon de l’agent. Corrigez une section et la suivante en tiendra compte."
        testId="slideover-memo"
        onClose={() => setPanel(null)}
      >
        {envelope && envelope.sections.length > 0 ? (
          <div className="space-y-3">
            {envelope.sections.map((section) => (
              <SectionEditor
                key={section.id}
                tenderId={tenderId}
                runId={envelope.runId}
                section={section}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Aucune section rédigée. Un dossier en no-go n&apos;est pas rédigé — c&apos;est
            volontaire.
          </p>
        )}
      </SlideOver>
    </div>
  );
}
