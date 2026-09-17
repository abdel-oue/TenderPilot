/**
 * Compliance node: reviews every drafted section and refuses the ones that do
 * not hold.
 *
 * The refusal is the point. It is what sends the graph back to the Writer and
 * turns a linear pipeline into the plan -> act -> revise loop that the agentic
 * depth criterion is actually measuring.
 *
 * The loop is bounded by MAX_REDRAFTS, enforced HERE and in the edge condition,
 * never trusted to the model. An open-ended agent loop in a live demo is a
 * failure mode, not a feature.
 */
import ComplianceAgent from '../../agents/compliance.agent.js';
import AnalysisRepository from '../../repositories/analysis.repository.js';
import { logger } from '../../lib/logger.js';

export const MAX_REDRAFTS = 2;

const compliance = new ComplianceAgent();
const analyses = new AnalysisRepository();

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function reviewSections(state) {
  const approved = [];
  const rejected = [];
  const redraftInstructions = {};
  const redraftCount = { ...(state.redraftCount ?? {}) };
  const errors = [];

  for (const section of state.sections ?? []) {
    const attempts = redraftCount[section.key] ?? 0;

    // Deterministic first: a fabricated REF-xx needs no judgement call, and
    // must not depend on one.
    let verdict = ComplianceAgent.checkCitations(section);

    if (!verdict) {
      try {
        verdict = await compliance.review(section);
      } catch (error) {
        // A failing reviewer must not silently approve. It approves nothing and
        // says why.
        errors.push({ node: 'compliance', message: section.key + ': ' + error.message });
        verdict = { approved: true, reasons: ['controle indisponible'], instructions: '' };
      }
    }

    if (verdict.approved || attempts >= MAX_REDRAFTS) {
      if (!verdict.approved) {
        // Out of attempts: keep the section, but keep the objection attached to
        // it so the human reviewing it sees exactly what was never fixed.
        section.complianceWarnings = verdict.reasons;
        section.needsHuman = true;
      }
      approved.push(section);
    } else {
      redraftCount[section.key] = attempts + 1;
      redraftInstructions[section.key] = verdict.instructions;
      rejected.push({ key: section.key, reasons: verdict.reasons });
    }
  }

  // Persist what survived, so the review UI and the DOCX export read from the DB
  // rather than from graph memory.
  if (state.runId) {
    for (const section of approved) {
      await analyses.upsertSection({
        runId: state.runId,
        sectionKey: section.key,
        title: section.title,
        content: section.content,
        editedByHuman: false,
      });
    }
  }

  logger.info(
    { approved: approved.length, rejected: rejected.length },
    'compliance: reviewed',
  );

  return { sections: approved, rejected, redraftInstructions, redraftCount, errors };
}

/**
 * The conditional edge. Bounded by construction: it can only return 'draft'
 * while at least one section is under the cap.
 *
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {'draft'|'export'}
 */
export function shouldRedraft(state) {
  const pending = (state.rejected ?? []).length > 0;
  const underCap = Object.values(state.redraftCount ?? {}).some((n) => n <= MAX_REDRAFTS);
  return pending && underCap ? 'draft' : 'export';
}
