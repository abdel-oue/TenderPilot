"use client";
// The review screen. Order on the page is deliberate and is the EX-04 user story:
// verdict, then what blocks it, then what it could not read, then the evidence.
import { Skeleton } from "@/components/ui/skeleton";
import AnalysisReasoning from "./analysisReasoning";
import BlockerList from "./blockerList";
import ComplianceMatrix from "./complianceMatrix";
import SectionEditor from "./sectionEditor";
import TracePanel from "./tracePanel";
import UnreadPagesBanner from "./unreadPagesBanner";
import UploadPanel from "./uploadPanel";
import VerdictHeader from "./verdictHeader";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useTender, useUploadTenderDocument } from "@/hooks/useTenders";
import { TENDER_DOCUMENT_KINDS } from "@tenderpilot/shared";

interface TenderDetailProps {
  tenderId: string;
}

export default function TenderDetail({ tenderId }: TenderDetailProps) {
  const tender = useTender(tenderId);
  const analysis = useAnalysis(tenderId);
  const upload = useUploadTenderDocument(tenderId);

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

  return (
    <div className="space-y-8">
      <VerdictHeader tenderId={tenderId} reference={tender.data.reference} analysis={envelope} />

      {/* EX-07 before anything derived from the text: what was not read changes
          how much the rest is worth. */}
      {result ? <UnreadPagesBanner unreadPages={result.unreadPages} /> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Points bloquants</h2>
        {result ? (
          <BlockerList blockers={result.blockers} />
        ) : (
          <p className="text-sm text-muted">Lancez l&apos;analyse pour les obtenir.</p>
        )}
      </section>

      {/* The verdict's own derivation, between the blockers and the evidence. */}
      {result ? <AnalysisReasoning result={result} /> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Matrice de conformité</h2>
        <ComplianceMatrix tenderId={tenderId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Mémoire technique</h2>
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
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Pièces du dossier</h2>
        <ul className="space-y-1 text-sm text-muted">
          {tender.data.documents.map((document) => (
            <li key={document.id}>
              {document.kind} · {document.originalName} · {document.pageCount} page(s) ·{" "}
              {document.extractionPath}
            </li>
          ))}
        </ul>
        <UploadPanel
          kinds={TENDER_DOCUMENT_KINDS}
          busy={upload.isPending}
          error={upload.isError ? (upload.error as Error).message : null}
          submitLabel="Ajouter une pièce"
          onSubmit={(files, kind) => upload.mutate({ file: files[0], kind })}
        />
      </section>

      <TracePanel trace={envelope?.nodeTrace ?? []} status={envelope?.status ?? "aucune analyse"} />
    </div>
  );
}
