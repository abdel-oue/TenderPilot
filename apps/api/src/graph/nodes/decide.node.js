// Qualifier, step 3: go / no-go, its justification, and the blockers first.
//
// EX-04. The blockers ARE the product: a bare verdict tells the dirigeant nothing
// they can act on.

import { findBlockers, verdict as computeVerdict } from '../../services/score.service.js';
import { logger } from '../../lib/logger.js';
import { isRenewableAttestation } from '../../lib/renewableAttestations.js';

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function decide(state) {
  const requirements = state.requirements ?? [];
  const needsHumanEvidence = (requirement, match) =>
    !isRenewableAttestation(requirement) &&
    requirement.obligation === 'eliminatoire' &&
    requirement.nature === 'capacite' &&
    match.status === 'met' &&
    match.evidenceValidated !== true;

  const matches = (state.matches ?? [])
    .filter((m) => requirements.some((r) => r.id === m.requirementId))
    .map((match) => {
      const requirement = requirements.find((r) => r.id === match.requirementId);
      if (!needsHumanEvidence(requirement, match)) return match;
      return {
        ...match,
        status: 'unknown',
        confidence: 0,
        reason: 'Capacite eliminatoire sans preuve validee : controle humain requis.',
      };
    });
  const allBlockers = findBlockers(requirements.filter((r) => r.quoteVerified !== false), matches);
  const decisions = state.humanDecisions ?? [];
  const dismissed = new Set(decisions.flatMap((d) => d.dismissedBlockers ?? []));
  const blockers = allBlockers.filter((b) => !dismissed.has(b.requirementId));

  // A criterion projected under this dossier's own elimination threshold is a
  // WARNING, not a blocker. Requirement coverage is not a technical mark, and
  // turning one into the other invented a disqualification on every dossier.
  // The human sees the risk and decides; the agent does not pretend to know.
  const warnings = (state.thresholdWarnings ?? []).map((t) => ({
    label: t.label,
    text: `Risque sur « ${t.label} » : ${t.points} points projetés pour un seuil éliminatoire de ${t.threshold}.`,
    detail:
      'Projection indicative fondée sur la couverture des exigences, pas une note ' +
      'réelle. À confirmer par un humain.',
  }));
  for (const requirement of requirements.filter(isRenewableAttestation)) {
    const match = matches.find((item) => item.requirementId === requirement.id);
    if (match?.status === 'met' && !/expir|renouvel|p[eé]rim/i.test(match.reason ?? '')) continue;
    warnings.push({
      label: 'Attestation à renouveler ou à vérifier',
      text: `${requirement.text} — ${match?.reason || 'Validité à vérifier.'}`,
      detail: 'Point de vigilance : obtenir une attestation valide avant le dépôt / la séance. Ce renouvellement ne constitue pas un motif de No-Go.',
    });
  }

  // The failures earlier nodes accumulated are an INPUT to the verdict, not a
  // footnote. A dossier whose ingestion or extraction fell over has not been
  // read, and a GO from a document nobody could parse is the worst output this
  // product can produce.
  const stageErrors = [...(state.errors ?? [])];
  const unread = (state.pages ?? []).filter((p) => p.extraction === 'unread');
  if (unread.length) stageErrors.push({ node: 'ingest', message: `${unread.length} page(s) illisible(s) : eligibilite non confirmee.` });
  if (requirements.some((r) => r.quoteVerified === false)) stageErrors.push({ node: 'extractRequirements', message: 'Certaines citations ne sont pas verifiees sur la page source.' });
  if (requirements.some((r) => !matches.some((m) => m.requirementId === r.id))) stageErrors.push({ node: 'matchProfile', message: 'Certaines exigences ne sont pas evaluees.' });
  const result = computeVerdict(state.score ?? 0, blockers, matches, stageErrors);
  const override = decisions.findLast((d) => d.verdictOverride)?.verdictOverride;
  if (override || dismissed.size) {
    if (override) result.verdict = override;
    result.needsHuman = true;
    result.justification = `Decision humaine explicite : ${result.verdict}. ` +
      (dismissed.size ? `${allBlockers.length - blockers.length} point(s) ecarte(s) par un humain. ` : '') + result.justification;
    warnings.push(...decisions.map((d) => ({ label: 'Arbitrage humain', text: d.instruction || 'Arbitrage enregistre dans la trace.', detail: d.verdictOverride ? `Verdict impose : ${d.verdictOverride}` : 'Points bloques arbitres par un humain.' })));
  }

  logger.info(
    {
      verdict: result.verdict,
      score: state.score,
      blockers: blockers.length,
      warnings: warnings.length,
      stageErrors: stageErrors.length,
      needsHuman: result.needsHuman,
    },
    'decide: done',
  );

  return { ...result, matches, blockers, warnings, errors: stageErrors.slice((state.errors ?? []).length) };
}
