import { describe, expect, it } from 'vitest';
import { decide } from '../../src/graph/nodes/decide.node.js';
import { coverageScore } from '../../src/services/score.service.js';

const requirement = (id, text) => ({ id, text, nature: 'capacite', obligation: 'eliminatoire', quoteVerified: true });
const match = (id, reason, status = 'unmet') => ({ requirementId: id, reason, status, confidence: 0.95 });

describe('renewable administrative attestations', () => {
  it.each(['Attestation fiscale valide', 'Attestation CNSS de moins de trois mois'])('keeps %s out of No-Go even when misclassified as a capability', async (text) => {
    const result = await decide({ requirements: [requirement('a', text)], matches: [match('a', 'Expirée le 12/08/2026 ; séance le 23/09/2026')], score: 0 });
    expect(result.verdict).toBe('go');
    expect(result.blockers).toEqual([]);
    expect(result.warnings[0].text).toContain('12/08/2026');
    expect(result.warnings[0].text).toContain('23/09/2026');
    expect(result.warnings[0].detail).toContain('avant le dépôt');
  });

  it.each([
    ['Chiffre d’affaires minimum de 10 millions', 'CA de 8 millions', 'unmet'],
    ['Certification ISO 27001 exigée', 'Certification non détenue', 'unmet'],
    ['Trois références dans le secteur bancaire', 'Deux références seulement', 'partial'],
    ['Chef de projet : expérience minimum de 10 ans', 'Huit ans d’expérience', 'partial'],
    ['Attestation de bonne exécution de trois références', 'Deux références', 'partial'],
    ['Attestation fiscale et chiffre d’affaires minimum de 10 millions', 'CA insuffisant', 'unmet'],
  ])('preserves a true blocker: %s', async (text, reason, status) => {
    const result = await decide({ requirements: [requirement('a', 'Attestation CNSS valide'), requirement('b', text)], matches: [match('a', 'Expirée'), match('b', reason, status)], score: 70 });
    expect(result.verdict).toBe('no-go');
    expect(result.blockers.map((item) => item.requirementId)).toEqual(['b']);
    expect(result.warnings).toHaveLength(1);
  });

  it('does not reduce capability coverage for a renewal', () => {
    expect(coverageScore([requirement('a', 'Attestation fiscale'), requirement('b', 'ISO 9001')], [match('a', 'Expirée'), match('b', 'Détenue', 'met')])).toBe(100);
  });
});
