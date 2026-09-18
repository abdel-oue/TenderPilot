import { describe, expect, it } from 'vitest';
import { isReadablePage } from '../../src/lib/pdf.js';

/**
 * The routing decision between the text-layer path and OCR, taken per page.
 * Getting it wrong in either direction is expensive: OCR on a readable page
 * wastes ~10s, and trusting an unreadable one yields requirements extracted from
 * noise - or, worse, none at all and no sign that anything was missed.
 */
describe('isReadablePage', () => {
  it('accepts a normal dossier page', () => {
    const text = 'Article premier - Objet de la consultation. '.repeat(8);
    expect(isReadablePage({ page: 1, text })).toBe(true);
  });

  it('rejects an empty page', () => {
    expect(isReadablePage({ page: 1, text: '' })).toBe(false);
  });

  it('ignores whitespace when measuring a page', () => {
    expect(isReadablePage({ page: 1, text: '   \n\t   \n  ' })).toBe(false);
  });

  it('rejects a scan that leaks a few stray glyphs', () => {
    // Real scanned PDFs rarely extract to exactly zero characters, so a bare
    // `length > 0` check sends them down the wrong path.
    expect(isReadablePage({ page: 1, text: 'i l' })).toBe(false);
  });

  it('rejects symbol soup from a broken font map', () => {
    // Long enough to pass a character count, and entirely worthless: this is what
    // a CID-encoded PDF with no ToUnicode map extracts to.
    const text = '<<>>{}[]()<<>>{}[]()<<>>{}[]()<<>>{}[]()<<>>{}[]()<<>>{}[]()';
    expect(isReadablePage({ page: 1, text })).toBe(false);
  });

  it('rejects a page of replacement characters', () => {
    expect(isReadablePage({ page: 1, text: '�'.repeat(60) })).toBe(false);
  });

  it('keeps a page whose decoding only stumbled here and there', () => {
    const text = 'Le candidat doit fournir une attestation CNSS de moins de trois mois. �';
    expect(isReadablePage({ page: 1, text })).toBe(true);
  });

  it('keeps a figures-heavy BPU page, where digits carry the meaning', () => {
    const text = '1 | 120,00 | 45 | 5400,00 | 2 | 340,50 | 12 | 4086,00 | 3 | 95,00 | 8 | 760,00';
    expect(isReadablePage({ page: 1, text })).toBe(true);
  });
});
