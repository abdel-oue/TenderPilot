// Scoring + go/no-go verdict. Pure functions: no SQL, no LLM, no clock.
//
// This is the one module that must be right. A wrong verdict is the product
// failing in front of the jury, so every rule here is deterministic and tested.

/**
 * Weight per obligation type. An eliminatory requirement is not "three times as
 * important" as an optional one in any real sense - the weights only shape the
 * score, never the verdict. The verdict is decided by blockers alone.
 */
const OBLIGATION_WEIGHT = { eliminatoire: 3, obligatoire: 2, optionnelle: 1 };

/** How much of a requirement each match status counts as covered. */
const STATUS_CREDIT = { met: 1, partial: 0.5, unmet: 0, unknown: 0 };

/**
 * Unmet ELIMINATORY requirements. One blocker is a no-go regardless of score.
 *
 * `unknown` counts as a blocker on purpose: an eliminatory requirement we could
 * not assess is a risk to surface, not a gap to hide. The cahier des charges is
 * explicit that flagging beats masking.
 *
 * @param {{ id: string, obligation: string, text: string, sourcePage: number, sourceArticle: string|null, sourceDocumentId: string|null }[]} requirements
 * @param {{ requirementId: string, status: string, reason: string }[]} matches
 * @returns {{ requirementId: string, text: string, reason: string, sourcePage: number|null, sourceArticle: string|null, sourceDocumentId: string|null }[]}
 */
export function findBlockers(requirements, matches) {
  const byId = new Map(matches.map((m) => [m.requirementId, m]));

  return requirements
    .filter((r) => r.obligation === 'eliminatoire')
    .filter((r) => {
      const status = byId.get(r.id)?.status ?? 'unknown';
      return status === 'unmet' || status === 'unknown';
    })
    .map((r) => {
      const match = byId.get(r.id);
      return {
        requirementId: r.id,
        text: r.text,
        reason:
          match?.reason ??
          "Exigence éliminatoire non évaluée : aucune correspondance trouvée dans le profil.",
        sourcePage: r.sourcePage ?? null,
        sourceArticle: r.sourceArticle ?? null,
        sourceDocumentId: r.sourceDocumentId ?? null,
      };
    });
}

/**
 * Weighted coverage of the requirements, 0-100.
 *
 * @param {{ id: string, obligation: string }[]} requirements
 * @param {{ requirementId: string, status: string }[]} matches
 * @returns {number} rounded to one decimal
 */
export function coverageScore(requirements, matches) {
  if (requirements.length === 0) return 0;
  const byId = new Map(matches.map((m) => [m.requirementId, m]));

  let earned = 0;
  let total = 0;
  for (const requirement of requirements) {
    const weight = OBLIGATION_WEIGHT[requirement.obligation] ?? 1;
    const status = byId.get(requirement.id)?.status ?? 'unknown';
    total += weight;
    earned += weight * (STATUS_CREDIT[status] ?? 0);
  }
  return total === 0 ? 0 : Math.round((earned / total) * 1000) / 10;
}

/**
 * Projects the dossier's OWN grading grid onto our coverage, and reports any
 * criterion whose elimination threshold we fall under.
 *
 * The threshold is never hardcoded: it comes from the grid parsed out of this
 * specific dossier, because every dossier grades differently.
 *
 * @param {{ label: string, maxPoints: number, weight: number, eliminationThreshold: number|null }[]} rubric
 * @param {number} coverage 0-100
 * @returns {{ breakdown: { label: string, points: number, maxPoints: number }[], thresholdBlockers: { label: string, points: number, threshold: number }[] }}
 */
export function projectRubric(rubric, coverage) {
  const breakdown = [];
  const thresholdBlockers = [];

  for (const criterion of rubric) {
    const maxPoints = Number(criterion.maxPoints) || 0;
    const points = Math.round(((coverage / 100) * maxPoints) * 10) / 10;
    breakdown.push({ label: criterion.label, points, maxPoints });

    const threshold =
      criterion.eliminationThreshold === null || criterion.eliminationThreshold === undefined
        ? null
        : Number(criterion.eliminationThreshold);

    if (threshold !== null && points < threshold) {
      thresholdBlockers.push({ label: criterion.label, points, threshold });
    }
  }

  return { breakdown, thresholdBlockers };
}

/**
 * The verdict. A single blocker forces no-go, whatever the score says.
 *
 * @param {number} score
 * @param {object[]} blockers
 * @param {{ requirementId: string, confidence: number }[]} [matches]
 * @returns {{ verdict: 'go'|'no-go', confidence: number, justification: string }}
 */
export function verdict(score, blockers, matches = []) {
  const confidences = matches.map((m) => m.confidence).filter((c) => typeof c === 'number');
  const meanConfidence =
    confidences.length === 0
      ? 0.5
      : Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100;

  if (blockers.length > 0) {
    const first = blockers[0];
    return {
      verdict: 'no-go',
      confidence: meanConfidence,
      justification:
        `${blockers.length} exigence(s) éliminatoire(s) non satisfaite(s). ` +
        `La plus bloquante : ${first.text ?? first.label}. ` +
        `Une seule suffit à écarter la candidature, quel que soit le reste du dossier.`,
    };
  }

  return {
    verdict: 'go',
    confidence: meanConfidence,
    justification:
      `Aucune exigence éliminatoire non satisfaite. ` +
      `Couverture pondérée des exigences : ${score}/100.`,
  };
}
