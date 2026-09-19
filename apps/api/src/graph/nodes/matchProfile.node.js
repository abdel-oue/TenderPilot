// Qualifier, step 1: confront every requirement with the company profile.

import MatcherAgent from '../../agents/matcher.agent.js';

const matcher = new MatcherAgent();
import CompanyRepository from '../../repositories/company.repository.js';

const companies = new CompanyRepository();
import { logger } from '../../lib/logger.js';

/**
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state
 */
export async function matchProfile(state) {
  if (state.requirements.length === 0) {
    return { matches: [], errors: [{ node: 'matchProfile', message: 'aucune exigence à évaluer' }] };
  }

  // One company per user, so the profile is fetched by the dossier's owner.
  const [profile, references, team] = await Promise.all([
    companies.getProfile(state.ownerId),
    companies.findAllReferences(state.ownerId),
    companies.findAllTeam(state.ownerId),
  ]);

  if (!profile) {
    return {
      matches: [],
      errors: [
        {
          node: 'matchProfile',
          message: "profil entreprise absent : importez votre profil avant d'analyser",
        },
      ],
    };
  }

  try {
    const { matches, toolCalls } = await matcher.match(
      state.requirements,
      { profile, references, team },
      { runId: state.runId, tenderId: state.tenderId, ownerId: state.ownerId },
    );
    logger.info(
      {
        matched: matches.length,
        met: matches.filter((m) => m.status === 'met').length,
        unmet: matches.filter((m) => m.status === 'unmet').length,
        unknown: matches.filter((m) => m.status === 'unknown').length,
        toolCalls: toolCalls.length,
      },
      'matchProfile: done',
    );
    return { matches, toolCalls };
  } catch (error) {
    logger.error({ err: error.message }, 'matchProfile: failed');
    return { matches: [], errors: [{ node: 'matchProfile', message: error.message }] };
  }
}
