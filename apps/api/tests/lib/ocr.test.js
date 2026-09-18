import { describe, expect, it } from 'vitest';
import { toPageRanges } from '../../src/lib/ocr.js';

/**
 * Grouping is what keeps per-page routing affordable: one pdftoppm call per
 * contiguous range rather than one per page, and a pure scan still costs the
 * single rasterization it always did.
 *
 * Pure function, so this runs with no pdftoppm and no tesseract installed.
 */
describe('toPageRanges', () => {
  it('collapses a whole scanned document into one range', () => {
    expect(toPageRanges([1, 2, 3, 4])).toEqual([{ first: 1, last: 4 }]);
  });

  it('keeps scattered annexes as separate ranges', () => {
    expect(toPageRanges([56, 57, 60])).toEqual([
      { first: 56, last: 57 },
      { first: 60, last: 60 },
    ]);
  });

  it('sorts pages that arrive out of order', () => {
    expect(toPageRanges([9, 3, 4, 10])).toEqual([
      { first: 3, last: 4 },
      { first: 9, last: 10 },
    ]);
  });

  it('tolerates a duplicate page number', () => {
    expect(toPageRanges([7, 7, 8])).toEqual([{ first: 7, last: 8 }]);
  });

  it('returns nothing when no page needs OCR', () => {
    expect(toPageRanges([])).toEqual([]);
  });
});
