// Scoring + go/no-go verdict. Pure functions: no SQL, no LLM, no clock.
//
// This is the one module that must be right. A wrong verdict is the product
// failing in front of the jury, so every rule here is deterministic and tested.

/**
 * Weight per obligation type. An eliminatory requirement is not "three times as
 * important" as an optional one in any real sense - the weights only shape the
 * score, never the verdict. The verdict is decided by blockers alone.
 */
import { isRenewableAttestation } from '../lib/renewableAttestations.js';

const OBLIGATION_WEIGHT = { eliminatoire: 3, obligatoire: 2, optionnelle: 1 };

/** How much of a requirement each match status counts as covered. */
const STATUS_CREDIT = { met: 1, partial: 0.5, unmet: 0, unknown: 0 };

/**
 * Unmet ELIMINATORY requirements. One blocker is a no-go regardless of score.
 *
 * `unknown` and `partial` count as blockers on purpose: an eliminatory
 * requirement we could not assess, or only half cover, is a risk to surface,
 * not a gap to hide. The cahier des charges is explicit that flagging beats
 * masking.
 *
 * @param {{ id: string, obligation: string, text: string, sourcePage: number, sourceArticle: string|null, sourceDocumentId: string|null }[]} requirements
 * @param {{ requirementId: string, status: string, reason: string }[]} matches
 * @returns {{ requirementId: string, text: string, reason: string, sourcePage: number|null, sourceArticle: string|null, sourceDocumentId: string|null }[]}
 */
export function findBlockers(requirements, matches) {
  const byId = new Map(matches.map((m) => [m.requirementId, m]));

  return requirements
    // Only an unmet CAPABILITY disqualifies. A procedural instruction ("deposer
    // avant le 12/03", "inclure l'acte d'engagement") is a task on the response
    // checklist - the company cannot fail it at analysis time, and treating it
    // as a capability gap disqualifies every dossier on principle.
    // Only a CAPABILITY disqualifies. A procedure is a task on the response
    // checklist and a notation threshold is an outcome of the commission's
    // scoring - the company can fail neither at analysis time, and treating them
    // as capability gaps disqualifies every dossier on principle.
    .filter((r) => r.obligation === 'eliminatoire' && r.nature === 'capacite' && !isRenewableAttestation(r))
    // `partial` blocks too. An eliminatory capability half-met is not met:
    // "2 references sur les 3 exigees" is a rejection at the commission, and
    // letting it through returned a confident GO on a dossier that cannot win.
    // The human can still override; the agent does not get to round up.
    .filter((r) => {
      const status = byId.get(r.id)?.status ?? 'unknown';
      return status === 'unmet' || status === 'unknown' || status === 'partial';
    })
    .map((r) => {
      const match = byId.get(r.id);
      const status = match?.status ?? 'unknown';
      return {
        requirementId: r.id,
        text: r.text,
        status,
        reason:
          match?.reason ??
          "Exigence éliminatoire non évaluée : aucune correspondance trouvée dans le profil.",
        // The agent's own certainty, carried through so the UI can show the
        // human which blocker is worth arbitrating first.
        confidence: typeof match?.confidence === 'number' ? match.confidence : null,
        sourcePage: r.sourcePage ?? null,
        sourceArticle: r.sourceArticle ?? null,
        sourceDocumentId: r.sourceDocumentId ?? null,
      };
    })
    .sort(bySeverity);
}

/**
 * Orders blockers worst-first.
 *
 * `unmet` outranks `partial`, which outranks `unknown`: a requirement the
 * profile positively fails is a harder fact than one it half-covers, which is
 * in turn harder than one we could not assess. Within a status, higher
 * confidence first, then document order.
 *
 * This ordering is load-bearing, not cosmetic. The verdict calls blockers[0]
 * "la plus bloquante" and the UI lists them in order - an unsorted list made
 * that sentence a claim about whichever requirement happened to be extracted
 * first, which is a confident statement the data did not support.
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function bySeverity(a, b) {
  const RANK = { unmet: 0, partial: 1, unknown: 2 };
  const rank = (blocker) => RANK[blocker.status] ?? 2;
  if (rank(a) !== rank(b)) return rank(a) - rank(b);

  const confidence = (blocker) => (typeof blocker.confidence === 'number' ? blocker.confidence : 0);
  if (confidence(a) !== confidence(b)) return confidence(b) - confidence(a);

  return (a.sourcePage ?? Number.MAX_SAFE_INTEGER) - (b.sourcePage ?? Number.MAX_SAFE_INTEGER);
}

/**
 * Weighted coverage of the requirements, 0-100.
 *
 * @param {{ id: string, obligation: string }[]} requirements
 * @param {{ requirementId: string, status: string }[]} matches
 * @returns {number} rounded to one decimal
 */
export function coverageScore(allRequirements, matches) {
  // Procedural items are scored as part of the response checklist, not of the
  // company's fitness, so they do not drag the coverage score down.
  const requirements = allRequirements.filter((r) => r.nature === 'capacite' && !isRenewableAttestation(r));
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
 * Projects the dossier's OWN grading grid onto our coverage.
 *
 * The shortfalls it returns are WARNINGS, never blockers. Requirement coverage is
 * not a technical mark: inferring "you will score under 60/85" from "38% of the
 * requirements are evidenced" is not a supportable claim, and it fired on every
 * single dossier when it was allowed to force a no-go. Refusing to invent a
 * disqualification is the whole point of this product.
 *
 * The threshold is never hardcoded: it comes from the grid parsed out of this
 * specific dossier, because every dossier grades differently.
 *
 * @param {{ label: string, maxPoints: number, weight: number, eliminationThreshold: number|null }[]} rubric
 * @param {number} coverage 0-100
 * @returns {{ breakdown: object[], thresholdWarnings: { label: string, points: number, threshold: number }[] }}
 */
export function projectRubric(rubric, coverage) {
  const breakdown = [];
  const thresholdBlockers = []; // returned as thresholdWarnings

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

  return { breakdown, thresholdWarnings: thresholdBlockers };
}

/**
 * The verdict. A single blocker forces no-go, whatever the score says.
 *
 * A GO is an assertion. It is only ever returned from evidence that exists: no
 * requirement analysed, or a stage that failed on the way here, is an ABSENCE of
 * findings and must never read as eligibility. Those cases come back no-go with
 * needsHuman, because "we could not tell" is the honest answer and the human is
 * the one allowed to overturn it.
 *
 * @param {number} score
 * @param {object[]} blockers
 * @param {{ requirementId: string, confidence: number }[]} [matches]
 * @param {{ node: string, message: string }[]} [stageErrors] failures accumulated by earlier nodes
 * @returns {{ verdict: 'go'|'no-go', confidence: number, justification: string, needsHuman: boolean }}
 */
export function verdict(score, blockers, matches = [], stageErrors = []) {
  const confidences = matches.map((m) => m.confidence).filter((c) => typeof c === 'number');
  const meanConfidence =
    confidences.length === 0
      ? 0.5
      : Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100;

  if (matches.length === 0 && blockers.length === 0) {
    return {
      verdict: 'no-go',
      confidence: 0,
      needsHuman: true,
      justification:
        "Analyse non concluante : aucune exigence n'a pu etre evaluee. " +
        (stageErrors.length > 0
          ? `Etapes en echec : ${stageErrors.map((e) => e.node).join(', ')}. `
          : '') +
        "L'absence de constat n'est pas une preuve d'eligibilite : a reprendre par un humain.",
    };
  }

  if (stageErrors.length > 0 && blockers.length === 0) {
    return {
      verdict: 'no-go',
      confidence: 0,
      needsHuman: true,
      justification:
        `Analyse incomplete : ${stageErrors.length} etape(s) en echec ` +
        `(${[...new Set(stageErrors.map((e) => e.node))].join(', ')}). ` +
        `Couverture calculee sur les seules exigences extraites : ${score}/100. ` +
        "Verdict a trancher par un humain, le dossier n'a pas ete lu en entier.",
    };
  }

  if (blockers.length > 0) {
    // findBlockers sorts worst-first, so this really is the most blocking one.
    const first = blockers[0];
    const unassessed = first.status === 'unknown';
    const halfMet = first.status === 'partial';
    return {
      verdict: 'no-go',
      confidence: meanConfidence,
      needsHuman: stageErrors.length > 0 || blockers.some((b) => b.status === 'unknown' || b.status === 'partial'),
      justification:
        `${blockers.length} exigence(s) éliminatoire(s) non satisfaite(s). ` +
        `La plus bloquante : ${first.text ?? first.label}. ` +
        (unassessed
          ? "Elle n'a pas pu être évaluée faute d'information : à trancher par un humain avant d'abandonner. "
          : '') +
        (halfMet
          ? 'Elle est partiellement couverte : le dossier ne la satisfait pas entièrement, ' +
            "à trancher par un humain avant d'abandonner. "
          : '') +
        `Une seule suffit à écarter la candidature, quel que soit le reste du dossier.`,
    };
  }

  return {
    verdict: 'go',
    confidence: meanConfidence,
    needsHuman: false,
    justification:
      `Aucune exigence éliminatoire non satisfaite. ` +
      `Couverture pondérée des exigences : ${score}/100.`,
  };
}
