import { describe, expect, it } from 'vitest';
import {
  canBlock,
  extractedRequirementsSchema,
  isEliminatory,
  requirementSchema,
} from '@tenderpilot/shared';

const valid = {
  id: 'r1',
  tenderId: 't1',
  text: 'Le candidat doit être certifié ISO 27001.',
  category: 'administrative',
  obligation: 'eliminatoire',
  nature: 'capacite',
  sourceDocumentId: 'd1',
  sourcePage: 3,
  sourceArticle: 'Article 7.2',
};

describe('requirementSchema', () => {
  it('accepts a fully provenanced requirement', () => {
    expect(requirementSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown category instead of passing it through', () => {
    const result = requirementSchema.safeParse({ ...valid, category: 'juridique' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown nature', () => {
    expect(requirementSchema.safeParse({ ...valid, nature: 'autre' }).success).toBe(false);
  });

  it('requires a nature, since it decides whether the requirement can block', () => {
    const { nature, ...withoutNature } = valid;
    expect(requirementSchema.safeParse(withoutNature).success).toBe(false);
  });

  it('rejects an unknown obligation', () => {
    expect(requirementSchema.safeParse({ ...valid, obligation: 'peut-etre' }).success).toBe(false);
  });

  it('rejects a missing source page, because EX-03 depends on it', () => {
    const { sourcePage, ...withoutPage } = valid;
    expect(requirementSchema.safeParse(withoutPage).success).toBe(false);
  });

  it('rejects page 0 and negative pages', () => {
    expect(requirementSchema.safeParse({ ...valid, sourcePage: 0 }).success).toBe(false);
    expect(requirementSchema.safeParse({ ...valid, sourcePage: -2 }).success).toBe(false);
  });

  it('allows a null article, since not every clause is numbered', () => {
    expect(requirementSchema.safeParse({ ...valid, sourceArticle: null }).success).toBe(true);
  });

  it('rejects empty requirement text', () => {
    expect(requirementSchema.safeParse({ ...valid, text: '' }).success).toBe(false);
  });
});

describe('extractedRequirementsSchema', () => {
  const extracted = {
    text: valid.text,
    category: valid.category,
    obligation: valid.obligation,
    nature: valid.nature,
    sourcePage: valid.sourcePage,
    sourceArticle: valid.sourceArticle,
    quote: 'Le candidat doit être certifié ISO 27001, sous peine de rejet.',
  };

  it('accepts what the Extractor is allowed to return', () => {
    expect(extractedRequirementsSchema.safeParse({ requirements: [extracted] }).success).toBe(true);
  });

  it('requires the verbatim quote, so a citation can never be fabricated later', () => {
    const { quote, ...withoutQuote } = extracted;
    const result = extractedRequirementsSchema.safeParse({ requirements: [withoutQuote] });
    expect(result.success).toBe(false);
  });

  it('rejects an empty quote as firmly as a missing one', () => {
    const result = extractedRequirementsSchema.safeParse({
      requirements: [{ ...extracted, quote: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty list: a dossier with no requirements is data, not an error', () => {
    expect(extractedRequirementsSchema.safeParse({ requirements: [] }).success).toBe(true);
  });

  it('rejects a bare array, which is the shape a model most often drifts to', () => {
    expect(extractedRequirementsSchema.safeParse([extracted]).success).toBe(false);
  });
});

describe('canBlock', () => {
  it('is true only for an eliminatory capability', () => {
    expect(canBlock({ obligation: 'eliminatoire', nature: 'capacite' })).toBe(true);
  });

  it('is false for an eliminatory procedure, which no company can fail today', () => {
    expect(canBlock({ obligation: 'eliminatoire', nature: 'procedure' })).toBe(false);
  });

  it('is false for a notation threshold, which is decided after submission', () => {
    expect(canBlock({ obligation: 'eliminatoire', nature: 'notation' })).toBe(false);
  });

  it('is false for a merely obligatory capability', () => {
    expect(canBlock({ obligation: 'obligatoire', nature: 'capacite' })).toBe(false);
  });
});

describe('isEliminatory', () => {
  it('is true only for the eliminatoire obligation', () => {
    expect(isEliminatory({ obligation: 'eliminatoire' })).toBe(true);
    expect(isEliminatory({ obligation: 'obligatoire' })).toBe(false);
    expect(isEliminatory({ obligation: 'optionnelle' })).toBe(false);
  });
});
