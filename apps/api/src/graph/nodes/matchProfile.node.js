// Qualifier, step 1: confront every requirement with the company profile.

import { isGraphBubbleUp } from '@langchain/langgraph';
import MatcherAgent from '../../agents/matcher.agent.js';
import EvidenceAgent from '../../agents/evidence.agent.js';
import { evidenceCatalog, validateMatchEvidence } from '../../lib/evidence.js';

const matcher = new MatcherAgent();
const reviewer = new EvidenceAgent();
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
      { runId: state.runId, tenderId: state.tenderId, ownerId: state.ownerId, node: 'matchProfile' },
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
    const checked = validateMatchEvidence(state.requirements, matches, evidenceCatalog({ profile, references, team }, toolCalls));
    if (checked.candidates.length) {
      const { reviews } = await reviewer.review(checked.candidates);
      for (const candidate of checked.candidates) {
        const target = checked.matches.find((m) => m.requirementId === candidate.requirement.id);
        const findings = reviews.filter((r) => r.requirementId === target.requirementId);
        const supported = findings.length === 1 && findings[0].supported;
        target.evidenceValidated = supported;
        if (!supported) {
          target.status = 'unknown';
          target.confidence = 0;
          target.reason = 'Controle des preuves : ' + (findings[0]?.reason ?? 'avis absent, controle humain requis.');
        }
      }
    }
    return { matches: checked.matches, toolCalls };
  } catch (error) {
    // ask_human suspended the run - not a failure, and swallowing it here would
    // hand the graph an empty match set as though the agent had found nothing.
    if (isGraphBubbleUp(error)) throw error;
    logger.error({ err: error.message }, 'matchProfile: failed');
    return { matches: [], errors: [{ node: 'matchProfile', message: error.message }] };
  }
}
