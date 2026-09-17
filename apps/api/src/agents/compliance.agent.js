/**
 * Compliance Agent
 * Reads a drafted section back against its own citations and REFUSES it when it
 * does not hold. The cahier des charges names this agent explicitly: "relit le
 * livrable contre la checklist et refuse de valider si une piece manque".
 *
 * Its refusal is what turns the pipeline into a loop - Writer -> Compliance ->
 * Writer - which is the "reviser" verb the agentic-depth criterion asks for.
 *
 * Runs on the VOLUME tier: it checks a short text against a short list. Cheap,
 * and run once per section per attempt.
 */
import LlmService, { TIERS } from '../services/llm.service.js';
import { COMPLIANCE_SYSTEM, renderComplianceTask } from '../prompts/writer.prompts.js';
import { COMPLIANCE_STUB, complianceVerdictSchema } from './writer.schema.js';

export default class ComplianceAgent {
  /** @param {LlmService} [llm] */
  constructor(llm = new LlmService()) {
    this.llm = llm;
  }

  /**
   * @param {{ title: string, content: string, citations: string[] }} section
   * @returns {Promise<{ approved: boolean, reasons: string[], instructions: string }>}
   */
  async review(section) {
    return this.llm.complete({
      name: 'compliance',
      tier: TIERS.VOLUME,
      system: COMPLIANCE_SYSTEM,
      user: renderComplianceTask(section),
      schema: complianceVerdictSchema,
      stub: COMPLIANCE_STUB,
    });
  }

  /**
   * A deterministic pre-check that runs before the model, because some refusals
   * do not need judgement and must not depend on one.
   *
   * Catches the expensive failure directly: a REF-xx or CV-xx in the body that
   * is not in the citations the tools actually returned is a fabricated
   * reference, full stop.
   *
   * @param {{ content: string, citations: string[] }} section
   * @returns {{ approved: boolean, reasons: string[], instructions: string }|null} null when it has no opinion
   */
  static checkCitations(section) {
    const cited = new Set((section.citations ?? []).map((c) => c.toUpperCase()));
    const mentioned = String(section.content).match(/\b(?:REF|CV)-\d{2}\b/gi) ?? [];
    const fabricated = [...new Set(mentioned.map((m) => m.toUpperCase()))].filter(
      (id) => !cited.has(id),
    );

    if (fabricated.length === 0) return null;

    return {
      approved: false,
      reasons: fabricated.map((id) => id + " est cite mais n'a ete renvoye par aucun outil."),
      instructions:
        'Retire ' +
        fabricated.join(', ') +
        " du texte. N'utilise que les identifiants presents dans les citations, " +
        "ou marque la section [A COMPLETER PAR L'HUMAIN].",
    };
  }
}
