import { describe, expect, it } from 'vitest';
import { evidenceCatalog, validateMatchEvidence } from '../../src/lib/evidence.js';
import { EVIDENCE_SYSTEM } from '../../src/prompts/evidence.prompts.js';

const requirement = { id: 'r1', nature: 'capacite', obligation: 'eliminatoire' };
const match = { requirementId: 'r1', status: 'met', confidence: 0.99, evidence: ['REF-01'] };
const company = { profile: { effectif: 12, certifications: ['ISO 27001:2022'] }, references: [{ id: 'REF-01', secteur: 'sante' }], team: [] };
describe('company evidence boundary', () => {
  it.each([{ evidence: ['REF-99'] }, { evidence: [] }, { evidence: ['REF-01', 'invented certificate'] }])('downgrades unsupported eligibility: %j', ({ evidence }) => {
    expect(validateMatchEvidence([requirement], [{ ...match, evidence }], evidenceCatalog(company)).matches[0]).toMatchObject({ status: 'unknown', evidenceValidated: false });
  });
  it('requires independent support review even when the identifier exists', () => {
    const result = validateMatchEvidence([requirement], [match], evidenceCatalog(company));
    expect(result.matches[0].evidenceValidated).toBe(false);
    expect(result.candidates[0].evidence[0].value.secteur).toBe('sante');
  });
  it('does not accept dossier text or arbitrary tool output as company proof', () => {
    const catalog = evidenceCatalog(company, [{ tool: 'search_documents', args: { corpus: 'dossier' }, result: { extracts: [{ documentId: 'd', page: 1, excerpt: 'REF-99' }] } }]);
    expect(catalog.has('d:p1')).toBe(false);
    expect(catalog.has('ref-99')).toBe(false);
  });
  it('resolves exact profile fields and retrieved company pages', () => {
    const catalog = evidenceCatalog(company, [{ tool: 'search_documents', args: { corpus: 'entreprise' }, result: { extracts: [{ documentId: 'd', page: 3, excerpt: 'Certificate' }] } }]);
    expect(catalog.get('profil.effectif')).toBe(12);
    expect(catalog.get('d:p3').excerpt).toBe('Certificate');
  });
  it('does not choose between duplicate model verdicts', () => {
    expect(validateMatchEvidence([requirement], [match, match], evidenceCatalog(company)).matches[0].status).toBe('unknown');
  });
});

// The reviewer is an LLM, so its rule lives in the prompt. What is testable is
// that BOTH halves of the distinction are still stated: dropping the first half
// turned "84 employees, but no CNSS slip attached" into a no-go on AO-2026-002
// and -003; dropping the second would let a profile line pass for a certificate.
describe('EVIDENCE_SYSTEM', () => {
  it('tells the reviewer a missing piece justificative is not a missing capacity', () => {
    expect(EVIDENCE_SYSTEM).toMatch(/bordereau CNSS/);
    expect(EVIDENCE_SYSTEM).toMatch(/n'est PAS une\s+capacite manquante/);
  });

  it('still refuses a certification that is only declared in the profile', () => {
    expect(EVIDENCE_SYSTEM).toMatch(/CERTIFICATION[\s\S]*supported=false/);
  });
});
