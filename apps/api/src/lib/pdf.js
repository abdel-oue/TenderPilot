// Text-layer PDF extraction. Page numbers are preserved, never reconstructed:
// EX-03 (one-click jump to the source page) is only possible because every page
// of text keeps the number it came from.

import { extractText, getDocumentProxy } from 'unpdf';

// A page with fewer than this many non-whitespace characters is treated as having
// no usable text layer. Scanned pages routinely yield a handful of stray glyphs
// rather than a clean zero, so a bare `length > 0` check routes them wrongly.
const MIN_CHARS_PER_PAGE = 40;

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
 * Routing decision, not a fallback: a dossier with no text layer takes the OCR
 * path. AO-2026-004 and AO-2026-009 are pure scans.
 * @param {{ page: number, text: string }[]} pages
 * @returns {boolean} true when at least one page carries real text
 */
export function hasTextLayer(pages) {
  return pages.some((p) => p.text.replace(/\s/g, '').length >= MIN_CHARS_PER_PAGE);
}

/**
 * @param {{ page: number, text: string }} page
 * @returns {boolean}
 */
export function pageHasText(page) {
  return page.text.replace(/\s/g, '').length >= MIN_CHARS_PER_PAGE;
}

/**
 * @param {Uint8Array|Buffer} buffer
 * @returns {Promise<number>}
 */
export async function pageCount(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  return pdf.numPages;
}
