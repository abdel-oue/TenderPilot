"use client";
// The dossier list: every tender with the verdict it already has.
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBadge } from "@/components/ui/verdictBadge";
import { useTenders } from "@/hooks/useTenders";
import { formatDate, formatScore } from "@/lib/utils/formatUtils";

export default function TenderList() {
  const { data, isPending, isError, error } = useTenders();

  // Three states, always.
  if (isPending) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p data-testid="tenders-error" className="text-sm text-no-go">
        {(error as Error).message}
      </p>
    );
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted">Aucun dossier. Déposez un avis pour commencer.</p>;
  }

  return (
    <ul data-testid="tender-list" className="space-y-2">
      {data.map((tender) => (
        <li key={tender.id}>
          <Link
            data-testid="tender-row"
            href={`/tenders/${tender.id}`}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-surface p-4 transition hover:bg-soft"
          >
            <div>
              <p className="font-semibold">{tender.reference}</p>
              <p className="text-mini text-muted">
                {tender.title ?? "Sans titre"} · déposé le {formatDate(tender.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-4 text-right">
              {tender.analysis?.verdict ? (
                <>
                  <span className="text-mini text-muted">
                    {formatScore(tender.analysis.score ?? null)}
                    {tender.analysis.blockers ? ` · ${tender.analysis.blockers} bloquant(s)` : ""}
                  </span>
                  <VerdictBadge verdict={tender.analysis.verdict} />
                </>
              ) : (
                <span className="text-mini uppercase text-muted">
                  {tender.analysis?.status ?? "non analysé"}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
