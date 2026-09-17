// OCR for scanned PDFs. AO-2026-004 and AO-2026-009 have no text layer at all.
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
 * Rasterizes every page and reads it with tesseract.
 *
 * A page that yields nothing is returned with empty text rather than dropped:
 * the caller marks it 'unread' so EX-07 can report it honestly instead of the
 * pipeline quietly pretending the page did not exist.
 *
 * @param {Uint8Array|Buffer} buffer
 * @param {string} [lang] tesseract language pack, defaults to OCR_LANG
 * @returns {Promise<{ page: number, text: string }[]>}
 */
export async function ocrPages(buffer, lang = env.OCR_LANG) {
  const workDir = await mkdtemp(join(tmpdir(), 'tenderpilot-ocr-'));
  const pdfPath = join(workDir, 'input.pdf');

  try {
    await writeFile(pdfPath, buffer);
    await run('pdftoppm', ['-r', String(RASTER_DPI), '-png', pdfPath, join(workDir, 'page')], {
      timeout: PER_PAGE_TIMEOUT_MS * 10,
    });

    const images = (await readdir(workDir)).filter((f) => f.endsWith('.png')).sort();
    const pages = [];

    for (const [index, image] of images.entries()) {
      const page = index + 1;
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

    logger.info({ pages: pages.length, lang }, 'ocr: done');
    return pages;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
