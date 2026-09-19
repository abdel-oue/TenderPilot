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
import { COMPLIANCE_STUB, complianceVerdictSchema } from './schema.js';

export default class ComplianceAgent {
  /** @param {LlmService} [llm] */
  constructor(llm = new LlmService()) {
    this.llm = llm;
  }

  /**
   * The reviewer is given the REQUIREMENTS the section is supposed to cover and
   * the evidence the tools actually returned, not just the prose and a list of
   * identifiers. Its instructions promised checks - "is a piece missing" - that
   * its inputs could not support: with only the text in front of it, the only
   * thing it could verify was the text's internal consistency.
   *
   * @param {{ title: string, content: string, citations: string[], toolCalls?: object[] }} section
   * @param {object[]} [requirements] the requirements this section must cover
   * @returns {Promise<{ approved: boolean, reasons: string[], instructions: string }>}
   */
  async review(section, requirements = []) {
    return this.llm.complete({
      name: 'compliance',
      tier: TIERS.VOLUME,
      system: COMPLIANCE_SYSTEM,
      user: renderComplianceTask(section, {
        requirements,
        evidence: ComplianceAgent.evidenceResults(section),
      }),
      schema: complianceVerdictSchema,
      stub: COMPLIANCE_STUB,
    });
  }

  /**
   * The identifiers the TOOLS actually returned, read out of the recorded tool
   * results rather than from anything the model said.
   *
   * This is the whole point of the check below. Comparing the body against
   * `section.citations` compared the Writer's prose to the Writer's own list:
   * inventing REF-99 in both fields passed a check whose entire job was to
   * catch exactly that, with zero tool calls made. The only trustworthy source
   * of "this reference exists" is a payload a repository returned.
   *
   * @param {{ toolCalls?: { result: unknown }[] }} section
   * @returns {Set<string>}
   */
  static evidenceIds(section) {
    const returned = JSON.stringify(ComplianceAgent.evidenceResults(section));
    return new Set((returned.match(/\b(?:REF|CV)-\d+\b/gi) ?? []).map((m) => m.toUpperCase()));
  }

  /** Only company data can evidence company experience; search queries and run state cannot. */
  static evidenceResults(section) {
    const isCompanyEvidence = (call) =>
      call.tool === 'get_company_facts' ||
      (call.tool === 'search_documents' && (call.args?.corpus ?? 'entreprise') === 'entreprise');

    return (section.toolCalls ?? [])
      .filter((call) => !call.result?.error && isCompanyEvidence(call))
      .map((call) => ({ tool: call.tool, result: call.result }));
  }

  /**
   * A deterministic pre-check that runs before the model, because some refusals
   * do not need judgement and must not depend on one.
   *
   * Catches the expensive failure directly: a REF-xx or CV-xx in the body - or
   * in the declared citations - that no tool ever returned is a fabricated
   * reference, full stop. The declared citations are checked too, because that
   * list is model output exactly as much as the prose is.
   *
   * @param {{ content: string, citations: string[], toolCalls?: object[] }} section
   * @returns {{ approved: boolean, reasons: string[], instructions: string }|null} null when it has no opinion
   */
  static checkCitations(section) {
    const evidence = ComplianceAgent.evidenceIds(section);
    const claimed = [
      ...(String(section.content).match(/\b(?:REF|CV)-\d+\b/gi) ?? []),
      ...(section.citations ?? []),
    ];
    const fabricated = [...new Set(claimed.map((id) => String(id).toUpperCase()))].filter(
      (id) => /^(?:REF|CV)-\d+$/.test(id) && !evidence.has(id),
    );

    if (fabricated.length === 0) return null;

    return {
      approved: false,
      reasons: fabricated.map((id) => id + " est cite mais n'a ete renvoye par aucun outil."),
      instructions:
        'Retire ' +
        fabricated.join(', ') +
        " du texte et des citations. N'utilise que les identifiants reellement " +
        "renvoyes par les outils, ou marque la section [A COMPLETER PAR L'HUMAIN].",
    };
  }
}
