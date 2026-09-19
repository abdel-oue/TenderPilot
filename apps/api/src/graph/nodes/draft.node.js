/**
 * Writer node: drafts the memoire technique section by section.
 *
 * Sections are grouped by requirement category, so each one is about one thing
 * and its evidence search is focused.
 *
 * EX-06: human corrections already saved for this run are fed into the prompt of
 * every later section. The reuse is the requirement, not the saving.
 */
import { isGraphBubbleUp } from '@langchain/langgraph';
import WriterAgent from '../../agents/writer.agent.js';
import AnalysisRepository from '../../repositories/analysis.repository.js';
import { logger } from '../../lib/logger.js';

const SECTION_TITLES = {
  technical: 'Solution technique et methodologie',
  team: 'Moyens humains',
  financial: 'Capacite financiere',
  schedule: 'Planning et delais',
  administrative: 'Pieces administratives',
};

const writer = new WriterAgent();
const analyses = new AnalysisRepository();

/**
 * @param {object[]} requirements
 * @returns {{ key: string, title: string, requirements: object[] }[]}
 */
export function planSections(requirements) {
  const byCategory = new Map();
  for (const requirement of requirements) {
    if (!byCategory.has(requirement.category)) byCategory.set(requirement.category, []);
    byCategory.get(requirement.category).push(requirement);
  }

  return [...byCategory.entries()].map(([key, reqs]) => ({
    key,
    title: SECTION_TITLES[key] ?? key,
    requirements: reqs,
  }));
}

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function draft(state) {
  const plan = planSections(state.requirements);
  if (plan.length === 0) {
    return { sections: [], errors: [{ node: 'draft', message: 'aucune exigence a rediger' }] };
  }

  // Sections a human already rewrote, so later sections align with them.
  // Scoped to the TENDER, not to this run: re-analysing mints a new runId, and a
  // correction that only survived inside one run was not actually reused.
  const humanEdits = state.tenderId
    ? await analyses.findHumanEditsForTender(state.tenderId)
    : [];

  // A retry only rewrites rejected sections. Accepted sections retain their evidence.
  const retrying = (state.rejected ?? []).length > 0;
  const sections = retrying ? [...(state.sections ?? [])] : [];
  const errors = [];
  const toolCalls = [];

  for (const section of plan) {
    if (retrying && !state.rejected.some((r) => r.key === section.key)) continue;
    const human = humanEdits.find((e) => e.sectionKey === section.key);
    if (human) {
      sections.push({
        key: section.key, title: human.title, content: human.content,
        citations: [], toolCalls: [], editedByHuman: true,
        validatedByHuman: human.runId === state.runId && Boolean(human.validatedByHuman),
        needsHuman: human.runId !== state.runId || !human.validatedByHuman,
        complianceWarnings: human.runId === state.runId ? (human.complianceWarnings ?? []) : ['Texte humain conserve : verifier son adequation aux exigences de cette nouvelle analyse.'],
      });
      continue;
    }
    // A section sent back by Compliance carries its instructions; a fresh one
    // does not.
    const instructions = state.redraftInstructions?.[section.key] ?? null;

    try {
      const drafted = await writer.draft(
        { title: section.title, requirements: section.requirements, humanEdits, instructions },
        { runId: state.runId, tenderId: state.tenderId, ownerId: state.ownerId, node: 'draft' },
      );
      sections.push({
        key: section.key,
        title: drafted.title,
        content: drafted.content,
        citations: drafted.citations,
        needsHuman: drafted.needsHuman,
        toolCalls: drafted.toolCalls,
      });
      toolCalls.push(...drafted.toolCalls.map((call) => ({ ...call, section: section.key })));
    } catch (error) {
      // LangGraph resumes at the node boundary; this node is replayed on resume.
      if (isGraphBubbleUp(error)) throw error;
      errors.push({ node: 'draft', message: section.key + ': ' + error.message });
      logger.error({ section: section.key, err: error.message }, 'draft: failed');
    }
  }

  logger.info(
    { sections: sections.length, needingHuman: sections.filter((s) => s.needsHuman).length },
    'draft: done',
  );

  return { sections, errors, toolCalls };
}
