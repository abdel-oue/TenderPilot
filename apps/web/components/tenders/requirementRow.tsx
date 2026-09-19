// One requirement, with its provenance. No business logic in here.
import { sourcePageUrl } from "@/lib/api/documents";
import { formatCitation, formatConfidence } from "@/lib/utils/formatUtils";
import { cn } from "@/lib/utils/classNameUtils";
import type { MatrixRow } from "@/lib/types";

interface RequirementRowProps {
  requirement: MatrixRow;
}

// EX-02: the three obligation types, visually distinct. `eliminatoire` is the one
// that can sink a dossier, so it is the one that reads loudest.
const OBLIGATION_STYLE: Record<string, string> = {
  eliminatoire: "border-no-go/40 bg-warning-soft text-no-go",
  obligatoire: "border-border bg-soft text-foreground",
  optionnelle: "border-border bg-transparent text-muted",
};

const MATCH_LABEL: Record<string, string> = {
  met: "couverte",
  partial: "partielle",
  unmet: "non couverte",
  unknown: "indéterminée",
};

export default function RequirementRow({ requirement }: RequirementRowProps) {
  const { match } = requirement;

  return (
    <tr data-testid="requirement-row" data-obligation={requirement.obligation} className="border-b border-border align-top">
      <td className="px-3 py-3">
        <p className="text-sm">{requirement.text}</p>
        {requirement.quote ? (
          <p className="mt-1 text-tiny italic text-muted">« {requirement.quote} »</p>
        ) : null}
        {requirement.quoteVerified === false ? <p data-testid="citation-unverified" className="mt-1 text-xs text-no-go">Citation non vérifiée sur la page indiquée — contrôle humain requis.</p> : null}
      </td>
      <td className="px-3 py-3">
        <span className={cn("inline-block rounded border px-2 py-0.5 text-mini uppercase", OBLIGATION_STYLE[requirement.obligation])}>
          {requirement.obligation}
        </span>
        <p className="mt-1 text-mini text-muted">{requirement.category} · {requirement.nature}</p>
      </td>
      <td className="px-3 py-3 text-sm">
        {/* EX-03: one click to the exact page of the original PDF. The column is
            ON DELETE SET NULL, so a requirement whose source document is gone
            shows the citation as plain text rather than a link to nowhere. */}
        {requirement.sourceDocumentId && requirement.quoteVerified !== false ? (
          <a
            data-testid="requirement-citation"
            className="cursor-pointer underline underline-offset-2"
            href={sourcePageUrl(requirement.sourceDocumentId, requirement.sourcePage)}
            target="_blank"
            rel="noreferrer"
          >
            {formatCitation(requirement.sourcePage, requirement.sourceArticle)}
          </a>
        ) : (
          <span className="text-muted">
            {formatCitation(requirement.sourcePage, requirement.sourceArticle)}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-sm">
        {match ? (
          <>
            <span data-testid="requirement-match" data-status={match.status}>
              {MATCH_LABEL[match.status]}
            </span>
            <span className="ml-2 text-mini text-muted">
              {formatConfidence(match.confidence)}
            </span>
            {match.evidence.length > 0 ? (
              <p className="mt-1 text-mini text-muted">{match.evidence.join(", ")}</p>
            ) : null}
            {/* WHY the profile answers this requirement the way it does. The api
                has always sent it; showing only the verdict made the matching
                look like a lookup rather than a judgement that can be argued
                with — and an empty `evidence` list unreadable. */}
            <p data-testid="requirement-reason" className="mt-1 text-tiny text-muted">
              {match.reason}
            </p>
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
}
