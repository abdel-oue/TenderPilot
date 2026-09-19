import { describe, expect, it } from 'vitest';
import { describeToolCall } from '../../src/lib/narration.js';

/**
 * French number grouping uses a narrow no-break space (U+202F), which is correct
 * typography and invisible in a diff. Normalising here keeps the assertions
 * readable without asserting the wrong character.
 */
const plain = (text) => text.replace(/[  ]/g, ' ');

describe('describeToolCall', () => {
  it('names what was searched and where, in words a dirigeant reads', () => {
    const phrase = describeToolCall(
      'search_documents',
      { query: 'chef de projet PMP', corpus: 'entreprise' },
      { extracts: [{ page: 12 }, { page: 4 }, { page: 12 }] },
    );
    expect(phrase).toBe(
      'recherche « chef de projet PMP » dans vos documents : 3 passages trouvés (p. 12, p. 4)',
    );
    expect(phrase).not.toContain('search_documents');
  });

  it('distinguishes the dossier from the company corpus', () => {
    expect(
      describeToolCall('search_documents', { query: 'caution', corpus: 'dossier' }, { extracts: [] }),
    ).toContain('dans le dossier de consultation');
  });

  it('says plainly when a search found nothing', () => {
    // The whole guardrail story depends on an empty result being legible as
    // empty rather than quietly absent from the feed.
    expect(
      describeToolCall('search_documents', { query: 'aeronautique', corpus: 'entreprise' }, { extracts: [] }),
    ).toContain('aucun passage ne correspond');
  });

  it('reports an unreadable page as unreadable, even after OCR', () => {
    expect(
      describeToolCall('read_source_page', { page: 47 }, { page: 47, readable: false }),
    ).toBe('page 47 du dossier : illisible, même après OCR');
  });

  it('mentions when a page had to be recovered by OCR', () => {
    expect(
      describeToolCall('read_source_page', { page: 9 }, { page: 9, readable: true, extraction: 'ocr' }),
    ).toContain('récupérée par OCR');
  });

  it('spells out a calculation with its result', () => {
    expect(
      plain(describeToolCall('calculate', { expression: '1.5% * 2400000' }, { value: 36000 })),
    ).toBe('calcul : 1.5% * 2400000 = 36 000');
  });

  it('gives both working and calendar days before a deadline', () => {
    const phrase = describeToolCall(
      'compute_deadline',
      { deadline: '12/03/2026' },
      { deadline: '2026-03-12', joursOuvres: 8, joursCalendaires: 10, depassee: false },
    );
    expect(phrase).toBe('échéance du 12/03/2026 : il reste 8 jours ouvrés (10 jours calendaires)');
  });

  it('says a deadline is blown rather than reporting a negative number', () => {
    expect(
      describeToolCall(
        'compute_deadline',
        {},
        { deadline: '2026-01-01', joursOuvres: -40, joursCalendaires: -60, depassee: true },
      ),
    ).toBe('échéance du 01/01/2026 : dépassée depuis 60 jours');
  });

  it('names the missing pieces rather than just counting them', () => {
    expect(
      describeToolCall(
        'check_dossier_checklist',
        {},
        { pieces: [{}, {}], manquantes: ['Attestation fiscale', 'Caution provisoire'] },
      ),
    ).toContain('2 pièces manquantes — Attestation fiscale ; Caution provisoire');
  });

  it('confirms a complete dossier just as plainly', () => {
    expect(
      describeToolCall('check_dossier_checklist', {}, { pieces: [{}], manquantes: [] }),
    ).toContain('toutes les pièces exigées sont déposées');
  });

  it('echoes the filters used on a reference lookup', () => {
    expect(
      plain(
        describeToolCall(
          'get_company_facts',
          { scope: 'references', secteur: 'assainissement', montantMin: 5000000 },
          { count: 2 },
        ),
      ),
    ).toBe(
      'consultation de vos références (secteur assainissement, montant ≥ 5 000 000) : 2 références trouvées',
    );
  });

  it('reports an absent profile as absent', () => {
    expect(describeToolCall('get_company_facts', { scope: 'profil' }, { profil: null })).toContain(
      'aucun profil importé',
    );
  });

  it('frames a simulation as a hypothesis, not a verdict', () => {
    expect(
      describeToolCall(
        'simulate_score',
        {},
        { actuel: { verdict: 'no-go' }, projete: { verdict: 'go' }, bloquantsRestants: [] },
      ),
    ).toBe('simulation : le verdict passerait de no-go à go, plus aucun point bloquant');
  });

  it('surfaces a failed tool as a failure', () => {
    // The reader has to know the agent reasoned WITHOUT this answer.
    expect(describeToolCall('search_documents', { query: 'x' }, { error: 'pgvector down' })).toBe(
      'échec : pgvector down',
    );
  });

  it('agrees in number for a single result', () => {
    expect(
      describeToolCall('search_documents', { query: 'x', corpus: 'entreprise' }, { extracts: [{ page: 3 }] }),
    ).toContain('1 passage trouvé (p. 3)');
  });

  it('falls back to the tool name rather than inventing a sentence', () => {
    expect(describeToolCall('un_outil_inconnu', {}, {})).toBe('un_outil_inconnu');
  });
});

describe('narration and the model', () => {
  it('describes the real result even when the model claimed otherwise', () => {
    // The point of building the outcome in code: the model fills `raison`, never
    // the result. A model insisting it found three references under a search
    // that returned none cannot make that claim appear in the feed.
    const phrase = describeToolCall(
      'search_documents',
      { query: 'ISO 27001', corpus: 'entreprise', raison: "J'ai trouvé trois références conformes." },
      { extracts: [] },
    );

    expect(phrase).toContain('aucun passage ne correspond');
    expect(phrase).not.toContain('trois');
  });
});
