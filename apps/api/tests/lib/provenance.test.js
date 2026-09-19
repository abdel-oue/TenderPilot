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
  it('verifies a quote that elides the middle of an enumeration', () => {
    // The AO-2026-004 regression: the extractor quotes one item out of a list as
    // "Le dossier administratif comprend ... l'attestation fiscale", which a
    // literal substring test can never match.
    const page = [{ page: 2, extraction: 'ocr', text: "Le dossier administratif comprend la declaration sur l'honneur, l'attestation fiscale et l'attestation CNSS." }];
    expect(verifyQuote({ sourcePage: 2, quote: "Le dossier administratif comprend ... l'attestation fiscale" }, page)).toBe(true);
  });

  it('refuses an elided quote whose segments are out of order in the source', () => {
    // Segments match in order and without overlapping, so an elision cannot be
    // used to stitch a sequence the document never wrote.
    const page = [{ page: 2, extraction: 'ocr', text: "Le dossier administratif comprend la declaration sur l'honneur, l'attestation fiscale et l'attestation CNSS." }];
    expect(verifyQuote({ sourcePage: 2, quote: "l'attestation CNSS ... la declaration sur l'honneur" }, page)).toBe(false);
  });

  it('still refuses an invented fragment hidden behind an ellipsis', () => {
    const page = [{ page: 2, extraction: 'ocr', text: "Le dossier administratif comprend l'attestation fiscale." }];
    expect(verifyQuote({ sourcePage: 2, quote: "Le dossier administratif comprend ... la certification ISO 22301" }, page)).toBe(false);
  });

  it('tolerates whitespace and apostrophe typography', () => {
    expect(verifyQuote({ sourcePage: 1, quote: "L'entreprise doit fournir" }, [{ page: 1, extraction: 'ocr', text: 'L’entreprise\n doit   fournir une attestation.' }])).toBe(true);
  });
});
