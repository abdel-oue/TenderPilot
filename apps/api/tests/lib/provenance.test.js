import { describe, expect, it } from 'vitest';
import { verifyQuote } from '../../src/lib/provenance.js';

describe('verifyQuote', () => {
  const pages = Array.from({ length: 80 }, (_, i) => ({ page: i + 1, extraction: 'text_layer', text: i === 46 ? 'Le candidat doit fournir trois references, sous peine de rejet.' : 'Conditions generales du marche.' }));
  it('verifies the clause on page 47 without renumbering pages', () => {
    expect(verifyQuote({ sourcePage: 47, quote: 'trois references, sous peine de rejet.' }, pages)).toBe(true);
  });
  it('rejects real words attributed to the wrong page or an absent page', () => {
    for (const sourcePage of [46, 81]) expect(verifyQuote({ sourcePage, quote: 'trois references' }, pages)).toBe(false);
  });
  it('rejects invented quotes and OCR marked unread', () => {
    expect(verifyQuote({ sourcePage: 47, quote: 'ISO 99999 obligatoire' }, pages)).toBe(false);
    expect(verifyQuote({ sourcePage: 47, quote: 'trois references' }, [{ ...pages[46], extraction: 'unread' }])).toBe(false);
  });
  it('tolerates whitespace and apostrophe typography', () => {
    expect(verifyQuote({ sourcePage: 1, quote: "L'entreprise doit fournir" }, [{ page: 1, extraction: 'ocr', text: 'L’entreprise\n doit   fournir une attestation.' }])).toBe(true);
  });
});
