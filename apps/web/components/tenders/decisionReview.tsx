"use client";

import { useState } from "react";
import type { Blocker } from "@tenderpilot/shared";
import { useReviewDecision } from "@/hooks/useAnalysis";
import { INPUT, SECONDARY } from "@/lib/utils/workspaceStyleUtils";

interface DecisionReviewProps { tenderId: string; runId: string; blockers: Blocker[] }

export function DecisionReview({ tenderId, runId, blockers }: DecisionReviewProps) {
  const [instruction, setInstruction] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const review = useReviewDecision(tenderId, runId);

  const toggleDismissed = (requirementId: string) =>
    setDismissed((ids) =>
      ids.includes(requirementId) ? ids.filter((id) => id !== requirementId) : [...ids, requirementId],
    );

  return (
    <details className="rounded border border-border p-3 text-left text-sm" data-testid="decision-review">
      <summary className="cursor-pointer">Arbitrer le verdict</summary>
      <p className="my-3 text-xs text-muted">Votre décision sera conservée avec son motif. Les réserves et les pages illisibles resteront visibles.</p>
      {blockers.filter((b) => b.requirementId).map((blocker) => (
        <label key={blocker.requirementId} className="my-2 flex items-start gap-2">
          <input
            type="checkbox"
            checked={dismissed.includes(blocker.requirementId!)}
            onChange={() => toggleDismissed(blocker.requirementId!)}
          />
          Écarter : {blocker.text}
        </label>
      ))}
      <label className="block">Motif de votre décision
        <textarea className={INPUT} data-testid="decision-reason" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
      </label>
      <div className="mt-3 flex gap-2">
        {(["go", "no-go"] as const).map((verdictOverride) => (
          <button key={verdictOverride} className={SECONDARY} data-testid={`decision-${verdictOverride}`} disabled={review.isPending || instruction.trim().length < 10}
            onClick={() => review.mutate({ verdictOverride, instruction, dismissedBlockers: dismissed })}>
            Décider {verdictOverride.toUpperCase()}
          </button>
        ))}
      </div>
      {review.error ? <p role="alert" className="text-no-go">{review.error.message}</p> : null}
    </details>
  );
}
