// Text-layer PDF extraction. Page numbers are preserved, never reconstructed:
// EX-03 (one-click jump to the source page) is only possible because every page
// of text keeps the number it came from.

import { extractText, getDocumentProxy } from 'unpdf';

// A page with fewer than this many non-whitespace characters is treated as having
// no usable text layer. Scanned pages routinely yield a handful of stray glyphs
// rather than a clean zero, so a bare `length > 0` check routes them wrongly.
const MIN_CHARS_PER_PAGE = 40;

// Quantity is not quality. A CID-encoded PDF with no ToUnicode map extracts
// hundreds of characters that are all wrong - it passes a character count and
// then the model extracts requirements from mojibake. These two ratios are the
// cheap shape test that catches it.
//
// Letters AND digits count, so a BPU page that is mostly figures stays readable.
const MIN_LETTER_RATIO = 0.5;
// U+FFFD and C0 controls. A handful survives a real page; a tenth of the page
// means the decoding failed.
const MAX_JUNK_RATIO = 0.1;
const JUNK = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/gu;

/**
 * @param {Uint8Array|Buffer} buffer
 * @returns {Promise<{ page: number, text: string }[]>} one entry per page, in order
 */
export async function extractPages(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((pageText, index) => ({
    page: index + 1,
    text: (pageText ?? '').trim(),
  }));
}

/**
 * The routing decision, taken PER PAGE rather than per document.
 *
 * A dossier is rarely all one thing: a 60-page CPS with five scanned annexes used
 * to take the text path as a whole, and those five pages were stored unread and
 * never OCR'd - invisible to the extractor. Judging each page on its own is what
 * makes the mixed case work, and it costs OCR only on the pages that need it.
 *
 * This is a shape heuristic, not a language model: a page of real text in an
 * unexpected script is sent to OCR, which costs ~10s and returns the same text.
 * Wrong in the safe direction.
 *
 * @param {{ page: number, text: string }} page
 * @returns {boolean} true when the text layer of this page is worth trusting
 */
export function isReadablePage(page) {
  const dense = (page.text ?? '').replace(/\s/g, '');
  if (dense.length < MIN_CHARS_PER_PAGE) return false;

  const junk = (dense.match(JUNK) ?? []).length;
  if (junk / dense.length > MAX_JUNK_RATIO) return false;

  const meaningful = (dense.match(LETTER_OR_DIGIT) ?? []).length;
  return meaningful / dense.length >= MIN_LETTER_RATIO;
}

/**
 * @param {Uint8Array|Buffer} buffer
 * @returns {Promise<number>}
 */
export async function pageCount(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  return pdf.numPages;
}
