// EX-04: the blockers, first on the page.
//
// "Je veux que les points bloquants apparaissent en premier, afin de trancher
// vite le go / no-go." They are the product, so they are not a section the
// reader scrolls to.
import { sourcePageUrl } from "@/lib/api/documents";
import type { Blocker } from "@tenderpilot/shared";

interface BlockerListProps {
  blockers: Blocker[];
}

export default function BlockerList({ blockers }: BlockerListProps) {
  if (blockers.length === 0) {
    return (
      <p data-testid="blocker-list-empty" className="text-sm text-muted">
        Aucun point bloquant identifié.
      </p>
    );
  }

  return (
    <ol data-testid="blocker-list" className="space-y-3">
      {blockers.map((blocker, index) => (
        <li
          key={`${blocker.requirementId ?? "x"}-${index}`}
          data-testid="blocker"
          className="rounded-md border border-no-go/40 bg-warning-soft p-4"
        >
          <p className="text-sm font-semibold">{blocker.text}</p>
          <p className="mt-1 text-sm text-muted">{blocker.reason}</p>
          {blocker.sourceDocumentId && blocker.sourcePage ? (
            <a
              className="mt-2 inline-block cursor-pointer text-tiny underline underline-offset-2"
              href={sourcePageUrl(blocker.sourceDocumentId, blocker.sourcePage)}
              target="_blank"
              rel="noreferrer"
            >
              {blocker.sourceArticle ? `art. ${blocker.sourceArticle}, ` : ""}page {blocker.sourcePage}
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
