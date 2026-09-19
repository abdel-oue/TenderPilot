// OCR for the pages a PDF's text layer could not give us. AO-2026-004 and
// AO-2026-009 have no text layer at all; a mixed dossier has a handful of scanned
// annexes among readable pages, and only those are rasterized.
//
// Two CLI binaries (poppler's pdftoppm + tesseract), installed in the api image,
// rather than a pure-JS OCR package: rasterizing a PDF in JavaScript needs a
// native canvas module, and this path is strictly less to go wrong in a container.
//
// Slow and expensive - always behind the content hash cache in cache.js.

import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { env } from './env.js';
import { logger } from './logger.js';

const run = promisify(execFile);

// Fixed DPI so the same scan produces the same text on every machine.
const RASTER_DPI = 200;
const PER_PAGE_TIMEOUT_MS = 90_000;

/** @returns {Promise<boolean>} whether the OCR toolchain is present on this machine */
export async function ocrAvailable() {
  try {
    await Promise.all([run('pdftoppm', ['-v']), run('tesseract', ['--version'])]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Groups page numbers into contiguous ranges, so a set of pages becomes as few
 * pdftoppm calls as possible.
 *
 * This is what makes per-page routing affordable in both directions: a pure scan
 * collapses to the single range 1..n - exactly one rasterization, the cost it
 * always had - while five scattered annexes in a 60-page dossier are five short
 * calls instead of rasterizing the whole document. No threshold constant, no
 * branch between "a few pages" and "all of them".
 *
 * @param {number[]} pages page numbers, any order, duplicates tolerated
 * @returns {{ first: number, last: number }[]} ranges in ascending order
 */
export function toPageRanges(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges = [];

  for (const page of sorted) {
    const current = ranges.at(-1);
    if (current && page === current.last + 1) current.last = page;
    else ranges.push({ first: page, last: page });
  }

  return ranges;
}

/**
 * Rasterizes one page range and reads each page with tesseract.
 *
 * The page number is parsed out of the filename pdftoppm produced, never counted
 * from the loop index: with -f/-l the output starts at the range's first page,
 * and counting would relabel page 56 as page 1. pdftoppm zero-pads to the width
 * of the document's page count, which the trailing-digits match absorbs.
 *
 * A page that yields nothing is returned with empty text rather than dropped:
 * the caller marks it 'unread' so EX-07 can report it honestly instead of the
 * pipeline quietly pretending the page did not exist.
 *
 * @param {Uint8Array|Buffer} buffer
 * @param {number} first 1-indexed, inclusive
 * @param {number} last 1-indexed, inclusive
 * @param {string} [lang] tesseract language pack, defaults to OCR_LANG
 * @returns {Promise<{ page: number, text: string }[]>}
 */
export async function ocrPageRange(buffer, first, last, lang = env.OCR_LANG) {
  const workDir = await mkdtemp(join(tmpdir(), 'tenderpilot-ocr-'));
  const pdfPath = join(workDir, 'input.pdf');
  const count = last - first + 1;

  try {
    await writeFile(pdfPath, buffer);
    await run(
      'pdftoppm',
      [
        '-f', String(first),
        '-l', String(last),
        '-r', String(RASTER_DPI),
        '-png',
        pdfPath,
        join(workDir, 'page'),
      ],
      { timeout: PER_PAGE_TIMEOUT_MS * Math.max(count, 2) },
    );

    const images = (await readdir(workDir)).filter((f) => f.endsWith('.png')).sort();
    const pages = [];

    for (const image of images) {
      const page = Number(image.match(/(\d+)\.png$/)?.[1]);
      if (!page) {
        logger.warn({ image }, 'ocr: unnumbered raster, skipped');
        continue;
      }
      try {
        const { stdout } = await run(
          'tesseract',
          [join(workDir, image), 'stdout', '-l', lang],
          { timeout: PER_PAGE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
        );
        pages.push({ page, text: stdout.trim() });
      } catch (error) {
        // One unreadable page must not lose the other six.
        logger.warn({ page, err: error.message }, 'ocr: page failed');
        pages.push({ page, text: '' });
      }
    }

    logger.info({ first, last, pages: pages.length, lang }, 'ocr: range done');
    return pages;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/**
 * OCRs exactly the pages asked for, as few rasterizations as their layout allows.
 *
 * @param {Uint8Array|Buffer} buffer
 * @param {number[]} pageNumbers the pages whose text layer was not usable
 * @param {string} [lang] tesseract language pack, defaults to OCR_LANG
 * @returns {Promise<{ page: number, text: string }[]>} ascending by page
 */
export async function ocrPages(buffer, pageNumbers, lang = env.OCR_LANG) {
  const ranges = toPageRanges(pageNumbers);
  const pages = [];

  for (const { first, last } of ranges) {
    try {
      pages.push(...(await ocrPageRange(buffer, first, last, lang)));
    } catch (error) {
      logger.warn({ first, last, err: error.message }, 'ocr: range failed, pages left unread');
      for (let page = first; page <= last; page += 1) pages.push({ page, text: '' });
    }
  }

  return pages.sort((a, b) => a.page - b.page);
}
