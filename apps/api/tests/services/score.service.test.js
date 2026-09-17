import { describe, expect, it } from 'vitest';
import {
  coverageScore,
  findBlockers,
  projectRubric,
  verdict,
} from '../../src/services/score.service.js';

const req = (id, obligation, extra = {}) => ({
  id,
  obligation,
  nature: 'capacite',
  text: `exigence ${id}`,
  sourcePage: 1,
  sourceArticle: null,
  sourceDocumentId: null,
  ...extra,
});
const match = (requirementId, status, confidence = 0.8) => ({
  requirementId,
  status,
  confidence,
  reason: 'r',
});

describe('findBlockers', () => {
  it('flags an unmet eliminatory requirement as a blocker', () => {
    const blockers = findBlockers([req('a', 'eliminatoire')], [match('a', 'unmet')]);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].requirementId).toBe('a');
  });

  it('flags an eliminatory requirement that was never assessed', () => {
    // No match at all -> 'unknown'. Surfacing beats hiding.
    expect(findBlockers([req('a', 'eliminatoire')], [])).toHaveLength(1);
  });

  it('does not flag an unmet requirement that is merely obligatoire', () => {
    expect(findBlockers([req('a', 'obligatoire')], [match('a', 'unmet')])).toHaveLength(0);
  });

  it('does not flag a satisfied eliminatory requirement', () => {
    expect(findBlockers([req('a', 'eliminatoire')], [match('a', 'met')])).toHaveLength(0);
  });

  it('does not block on a notation threshold nobody can hold in advance', () => {
    // "Obtenir une note technique d'au moins 60/85" is an outcome of the
    // commission's scoring, not something a profile can evidence.
    const notation = req('a', 'eliminatoire', { nature: 'notation' });
    expect(findBlockers([notation], [match('a', 'unknown')])).toHaveLength(0);
  });

  it('does not block on a procedural requirement the company cannot fail today', () => {
    // "Deposer le pli avant le 12/03" is eliminatory in the dossier's own words,
    // but it is a task on the response checklist, not evidence the company is
    // ineligible. Blocking on it disqualifies every dossier on principle.
    const procedural = req('a', 'eliminatoire', { nature: 'procedure' });
    expect(findBlockers([procedural], [match('a', 'unknown')])).toHaveLength(0);
  });

  it('still blocks on an unmet capability', () => {
    const capability = req('a', 'eliminatoire', { nature: 'capacite' });
    expect(findBlockers([capability], [match('a', 'unmet')])).toHaveLength(1);
  });

  it('carries the source page through, so the blocker stays clickable', () => {
    const blockers = findBlockers(
      [req('a', 'eliminatoire', { sourcePage: 47, sourceArticle: 'Article 12' })],
      [match('a', 'unmet')],
    );
    expect(blockers[0]).toMatchObject({ sourcePage: 47, sourceArticle: 'Article 12' });
  });
});

describe('coverageScore', () => {
  it('matches a hand-computed weighted sum', () => {
    // eliminatoire(3) met=3/3 + obligatoire(2) partial=1/2 + optionnelle(1) unmet=0/1
    // earned 3 + 1 + 0 = 4, total 3 + 2 + 1 = 6 -> 66.7
    const requirements = [
      req('a', 'eliminatoire'),
      req('b', 'obligatoire'),
      req('c', 'optionnelle'),
    ];
    const matches = [match('a', 'met'), match('b', 'partial'), match('c', 'unmet')];
    expect(coverageScore(requirements, matches)).toBe(66.7);
  });

  it('scores only capabilities, leaving procedure and notation out', () => {
    const requirements = [
      req('a', 'eliminatoire', { nature: 'capacite' }),
      req('b', 'eliminatoire', { nature: 'procedure' }),
      req('c', 'eliminatoire', { nature: 'notation' }),
    ];
    // Only 'a' counts, and it is met, so coverage is total rather than halved by
    // a checklist item nobody has done yet.
    expect(
      coverageScore(requirements, [match('a', 'met'), match('b', 'unknown'), match('c', 'unknown')]),
    ).toBe(100);
  });

  it('scores an empty requirement set as 0 rather than dividing by zero', () => {
    expect(coverageScore([], [])).toBe(0);
  });

  it('treats an unmatched requirement as uncovered', () => {
    expect(coverageScore([req('a', 'obligatoire')], [])).toBe(0);
  });
});

describe('projectRubric', () => {
  it("warns - never blocks - when a criterion falls under this dossier's threshold", () => {
    const rubric = [
      { label: 'Valeur technique', maxPoints: 85, weight: 0.7, eliminationThreshold: 60 },
    ];
    // 50% coverage of 85 points = 42.5, under the 60-point threshold.
    const { breakdown, thresholdWarnings } = projectRubric(rubric, 50);
    expect(breakdown[0]).toMatchObject({ points: 42.5, maxPoints: 85 });
    expect(thresholdWarnings).toEqual([
      { label: 'Valeur technique', points: 42.5, threshold: 60 },
    ]);
  });

  it('reports nothing when the criterion has no threshold', () => {
    const rubric = [{ label: 'Prix', maxPoints: 15, weight: 0.3, eliminationThreshold: null }];
    expect(projectRubric(rubric, 10).thresholdWarnings).toEqual([]);
  });
});

describe('verdict', () => {
  it('returns no-go when a blocker exists, however high the score', () => {
    const result = verdict(98, [{ text: 'ISO 27001 absente' }], [match('a', 'met', 0.9)]);
    expect(result.verdict).toBe('no-go');
    expect(result.justification).toContain('ISO 27001 absente');
  });

  it('returns go when there is no blocker', () => {
    expect(verdict(71, [], [match('a', 'met', 0.9)]).verdict).toBe('go');
  });

  it('averages the per-requirement confidences rather than asserting certainty', () => {
    const result = verdict(71, [], [match('a', 'met', 1), match('b', 'met', 0.5)]);
    expect(result.confidence).toBe(0.75);
  });
});
