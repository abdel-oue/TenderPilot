import { z } from 'zod';
import LlmService, { TIERS } from '../services/llm.service.js';
import { EVIDENCE_SYSTEM, renderEvidenceTask } from '../prompts/evidence.prompts.js';

const schema = z.object({ reviews: z.array(z.object({ requirementId: z.string(), supported: z.boolean(), reason: z.string().min(1) })) });

export default class EvidenceAgent {
  /** @param {LlmService} llm */
  constructor(llm = new LlmService()) { this.llm = llm; }
  /** @param {object[]} candidates @returns {Promise<object>} */
  async review(candidates) {
    return this.llm.complete({ name: 'evidenceAudit', tier: TIERS.VOLUME, system: EVIDENCE_SYSTEM,
      user: renderEvidenceTask(candidates), schema,
      stub: { reviews: candidates.map(({ requirement }) => ({ requirementId: requirement.id, supported: false, reason: 'Mode simulation : preuve non verifiee.' })) } });
  }
}
