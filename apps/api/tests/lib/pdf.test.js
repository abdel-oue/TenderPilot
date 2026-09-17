import { describe, expect, it } from 'vitest';
import { hasTextLayer, pageHasText } from '../../src/lib/pdf.js';

/**
 * The routing decision between the text-layer path and OCR. Getting it wrong in
 * either direction is expensive: OCR on a readable PDF wastes ~10s a page, and
 * the text path on a scan silently yields zero requirements.
 */
describe('hasTextLayer', () => {
  it('routes a normal dossier to the text-layer path', () => {
    const pages = [{ page: 1, text: 'Article premier - Objet de la consultation. '.repeat(8) }];
    expect(hasTextLayer(pages)).toBe(true);
  });

  it('routes a pure scan to OCR', () => {
    expect(hasTextLayer([{ page: 1, text: '' }, { page: 2, text: '' }])).toBe(false);
  });

  it('routes to OCR when a scan leaks a few stray glyphs', () => {
    // Real scanned PDFs rarely extract to exactly zero characters, so a bare
    // `length > 0` check sends them down the wrong path.
    expect(hasTextLayer([{ page: 1, text: 'i l' }, { page: 2, text: '.' }])).toBe(false);
  });

  it('keeps the text path when only some pages are scanned', () => {
    const pages = [
      { page: 1, text: 'Reglement de la consultation, article 3. '.repeat(5) },
      { page: 2, text: '' },
    ];
    expect(hasTextLayer(pages)).toBe(true);
  });

  it('treats an empty document as having no text layer', () => {
    expect(hasTextLayer([])).toBe(false);
  });
});

describe('pageHasText', () => {
  it('ignores whitespace when measuring a page', () => {
    expect(pageHasText({ page: 1, text: '   \n\t   \n  ' })).toBe(false);
  });

  it('accepts a page with real content', () => {
    expect(pageHasText({ page: 1, text: 'Le candidat doit fournir une attestation CNSS.' })).toBe(true);
  });
});
