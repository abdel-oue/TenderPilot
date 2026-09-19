import { describe, expect, it } from 'vitest';
import ComplianceAgent from '../../src/agents/compliance.agent.js';

/**
 * The deterministic half of the Compliance check. This one must not depend on a
 * model: "l'agent ne fabrique pas de reference" is a named jury test, and a
 * fabricated REF-xx is detectable without judgement.
 */
describe('ComplianceAgent.checkCitations', () => {
  it('refuses a reference that no tool returned', () => {
    const verdict = ComplianceAgent.checkCitations({
      content: 'Nous avons mene une mission similaire (REF-07) pour un client public.',
      citations: [],
    });
    expect(verdict.approved).toBe(false);
    expect(verdict.reasons[0]).toContain('REF-07');
  });

  it('approves a reference the tools actually returned', () => {
    expect(
      ComplianceAgent.checkCitations({
        content: 'Mission similaire (REF-07).',
        citations: ['REF-07'],
        toolCalls: [{ tool: 'get_company_facts', result: { references: [{ id: 'REF-07', client: 'ONCF' }] } }],
      }),
    ).toBeNull();
  });

  it('catches a fabricated CV as readily as a fabricated reference', () => {
    const verdict = ComplianceAgent.checkCitations({
      content: 'Le chef de projet (CV-03) totalise 12 ans.',
      citations: ['REF-01'],
    });
    expect(verdict.approved).toBe(false);
    expect(verdict.reasons[0]).toContain('CV-03');
  });

  it('is case insensitive, since the model does not always shout', () => {
    expect(
      ComplianceAgent.checkCitations({ content: 'voir ref-07', citations: ['REF-07'], toolCalls: [{ tool: 'search_documents', args: { corpus: 'entreprise' }, result: { extracts: [{ excerpt: 'Mission ref-07' }] } }] }),
    ).toBeNull();
  });

  it('reports each fabricated identifier once, not once per mention', () => {
    const verdict = ComplianceAgent.checkCitations({
      content: 'REF-07 puis REF-07 encore, et REF-09.',
      citations: [],
    });
    expect(verdict.reasons).toHaveLength(2);
  });

  it('has no opinion on a section that cites nothing at all', () => {
    // An honest "[A COMPLETER PAR L'HUMAIN]" cites nothing and must pass this gate.
    expect(
      ComplianceAgent.checkCitations({
        content: "[A COMPLETER PAR L'HUMAIN] Aucune reference dans ce secteur.",
        citations: [],
      }),
    ).toBeNull();
  });

  it('tells the Writer exactly what to remove', () => {
    const verdict = ComplianceAgent.checkCitations({ content: 'REF-42', citations: [] });
    expect(verdict.instructions).toContain('REF-42');
  });
});
