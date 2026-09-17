// Qualifier, step 1: confront every requirement with the company profile.

import { matchRequirements } from '../../agents/matcher.agent.js';
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

  const [profile, references, team] = await Promise.all([
    companies.getProfile(),
    companies.findAllReferences(),
    companies.findAllTeam(),
  ]);

  if (!profile) {
    return {
      matches: [],
      errors: [{ node: 'matchProfile', message: 'profil entreprise absent : lancez db:seed' }],
    };
  }

  try {
    const { matches } = await matchRequirements(state.requirements, { profile, references, team });
    logger.info(
      {
        matched: matches.length,
        met: matches.filter((m) => m.status === 'met').length,
        unmet: matches.filter((m) => m.status === 'unmet').length,
        unknown: matches.filter((m) => m.status === 'unknown').length,
      },
      'matchProfile: done',
    );
    return { matches };
  } catch (error) {
    logger.error({ err: error.message }, 'matchProfile: failed');
    return { matches: [], errors: [{ node: 'matchProfile', message: error.message }] };
  }
}
