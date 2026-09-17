/**
 * Writer node: drafts the memoire technique section by section.
 *
 * Sections are grouped by requirement category, so each one is about one thing
 * and its evidence search is focused.
 *
 * EX-06: human corrections already saved for this run are fed into the prompt of
 * every later section. The reuse is the requirement, not the saving.
 */
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
  const saved = state.runId ? await analyses.findSections(state.runId) : [];
  const humanEdits = saved.filter((s) => s.editedByHuman);

  const sections = [];
  const errors = [];

  for (const section of plan) {
    // A section sent back by Compliance carries its instructions; a fresh one
    // does not.
    const instructions = state.redraftInstructions?.[section.key] ?? null;

    try {
      const drafted = await writer.draft(
        { title: section.title, requirements: section.requirements, humanEdits, instructions },
        { runId: state.runId, tenderId: state.tenderId },
      );
      sections.push({
        key: section.key,
        title: drafted.title,
        content: drafted.content,
        citations: drafted.citations,
        needsHuman: drafted.needsHuman,
        toolCalls: drafted.toolCalls,
      });
    } catch (error) {
      errors.push({ node: 'draft', message: section.key + ': ' + error.message });
      logger.error({ section: section.key, err: error.message }, 'draft: failed');
    }
  }

  logger.info(
    { sections: sections.length, needingHuman: sections.filter((s) => s.needsHuman).length },
    'draft: done',
  );

  return { sections, errors };
}
