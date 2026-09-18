// Extractor, step 1: PDF bytes -> pages, each keeping the number it came from.
//
// Routing per PAGE, not per document, and not a fallback: every page is read with
// unpdf first, and only the pages whose text layer is not usable are rasterized
// and OCR'd. A 60-page CPS with five scanned annexes costs five pages of OCR -
// and, more to the point, those five pages stop being invisible. Deciding once
// for the whole document meant a single readable page sent the annexes to the
// unread pile, where the extractor never saw them.
//
// A page that yields no usable text after BOTH paths is kept as a row with
// extraction: 'unread'. That list is EX-07 - "signale explicitement les pages
// non lues, et n'invente aucune exigence" - and silently dropping it is the
// failure mode the jury tests for.

import { readFile } from 'node:fs/promises';
import { getCachedPages, hashFile } from '../../lib/cache.js';
import { logger } from '../../lib/logger.js';
import { ocrAvailable, ocrPages } from '../../lib/ocr.js';
import { extractPages, isReadablePage } from '../../lib/pdf.js';
import DocumentRepository from '../../repositories/document.repository.js';

const documentsRepo = new DocumentRepository();

/**
 * What the document as a whole turned out to be, derived from its pages rather
 * than decided up front.
 * @param {{ extraction: string }[]} pages
 * @returns {string} text_layer|ocr|mixed
 */
export function documentExtractionPath(pages) {
  const used = new Set(pages.map((p) => p.extraction).filter((e) => e !== 'unread'));
  if (used.size === 1) return [...used][0];
  if (used.size === 0) return 'ocr'; // nothing readable: OCR was tried and failed
  return 'mixed';
}

/**
 * Reads every page, then OCRs only the ones the text layer could not give us.
 *
 * @param {Uint8Array|Buffer} buffer
 * @param {string} filePath for the error message only
 * @returns {Promise<{ page: number, text: string, extraction: string }[]>}
 */
export async function readPages(buffer, filePath) {
  const extracted = await extractPages(buffer);
  const labelled = extracted.map((p) => ({
    page: p.page,
    text: p.text,
    extraction: isReadablePage(p) ? 'text_layer' : 'unread',
  }));

  const needOcr = labelled.filter((p) => p.extraction === 'unread').map((p) => p.page);
  if (needOcr.length === 0) return labelled;

  if (!(await ocrAvailable())) {
    if (labelled.length === needOcr.length) {
      // Nothing readable at all and no OCR: loud and explicit. A scan silently
      // returning zero requirements is the exact "erreur silencieuse" EX-07 forbids.
      throw new Error(
        `${filePath} has no text layer and the OCR toolchain ` +
          '(pdftoppm, tesseract) is not installed on this machine.',
      );
    }
    // Some pages did read. A partially read document with an honest unread list
    // beats refusing the dossier outright.
    logger.warn(
      { filePath, unread: needOcr.length },
      'ingest: no OCR toolchain, pages left unread',
    );
    return labelled;
  }

  logger.info({ filePath, pages: needOcr.length }, 'ingest: routing pages to OCR');
  const ocred = new Map((await ocrPages(buffer, needOcr)).map((p) => [p.page, p.text]));

  return labelled.map((p) => {
    if (p.extraction !== 'unread') return p;
    const text = ocred.get(p.page) ?? '';
    // The OCR output is held to the same standard as the text layer was.
    return isReadablePage({ page: p.page, text })
      ? { page: p.page, text, extraction: 'ocr' }
      : { page: p.page, text, extraction: 'unread' };
  });
}

/**
 * OCRs the unread pages of a document that was stored from its text layer alone.
 *
 * Bounded by the stored state itself: only a document still marked 'text_layer'
 * was never OCR'd, and the repair moves it to 'mixed' or 'ocr'. A genuinely blank
 * separator page therefore costs one OCR pass ever, not one per analysis.
 *
 * @param {{ documentId: string, extractionPath: string, pages: object[] }} cached
 * @param {Uint8Array|Buffer} buffer
 * @param {string} filePath
 * @returns {Promise<object[]>} the pages, repaired where OCR could read them
 */
async function repairUnreadPages(cached, buffer, filePath) {
  const unread = cached.pages.filter((p) => p.extraction === 'unread');
  if (unread.length === 0 || cached.extractionPath !== 'text_layer') return cached.pages;

  if (!(await ocrAvailable())) {
    logger.warn({ filePath, unread: unread.length }, 'ingest: no OCR toolchain, repair skipped');
    return cached.pages;
  }

  logger.info({ filePath, pages: unread.length }, 'ingest: repairing unread pages with OCR');
  const ocred = new Map(
    (await ocrPages(buffer, unread.map((p) => p.page))).map((p) => [p.page, p.text]),
  );

  const repaired = cached.pages.map((p) => {
    if (p.extraction !== 'unread') return p;
    const text = ocred.get(p.page) ?? '';
    return isReadablePage({ page: p.page, text })
      ? { ...p, text, extraction: 'ocr' }
      : p;
  });

  for (const [index, page] of repaired.entries()) {
    if (page.extraction === 'ocr' && cached.pages[index].extraction === 'unread') {
      await documentsRepo.updateChunk(page.id, { content: page.text, extraction: 'ocr' });
    }
  }

  // Marks the attempt, whether or not it recovered anything: this is what stops
  // the repair running again on every analysis.
  await documentsRepo.updateExtractionPath(cached.documentId, documentExtractionPath(repaired));

  const recovered = repaired.filter((p) => p.extraction === 'ocr').length;
  logger.info({ documentId: cached.documentId, recovered }, 'ingest: repair done');
  return repaired;
}

/**
 * Reads one document, using the cache when the bytes are unchanged.
 * @param {{ id: string, ownerId: string, filePath: string, tenderId?: string|null, kind?: string }} document
 * @returns {Promise<{ documentId: string, pages: object[], extractionPath: string }>}
 */
export async function ingestDocument(document) {
  const buffer = await readFile(document.filePath);
  const hash = hashFile(buffer);

  const cached = await getCachedPages(hash, document.ownerId);
  if (cached) {
    logger.info({ documentId: cached.documentId }, 'ingest: cache hit');
    const pages = await repairUnreadPages(cached, buffer, document.filePath);
    return { documentId: cached.documentId, pages, extractionPath: 'cached' };
  }

  const labelled = await readPages(buffer, document.filePath);
  const extractionPath = documentExtractionPath(labelled);

  const saved = await documentsRepo.upsert({
    ownerId: document.ownerId,
    tenderId: document.tenderId ?? null,
    kind: document.kind ?? 'avis',
    filePath: document.filePath,
    contentHash: hash,
    extractionPath,
    pageCount: labelled.length,
  });

  // Re-ingesting replaces this document's chunks only - never a blanket delete.
  await documentsRepo.deleteChunks(saved.id);
  await documentsRepo.insertChunks(
    labelled.map((p) => ({
      documentId: saved.id,
      page: p.page,
      article: null,
      content: p.text,
      extraction: p.extraction,
    })),
  );

  const unread = labelled.filter((p) => p.extraction === 'unread').length;
  logger.info(
    { documentId: saved.id, pages: labelled.length, extractionPath, unread },
    'ingest: document read',
  );

  return { documentId: saved.id, pages: labelled, extractionPath };
}

/**
 * Graph node. Reads every document attached to the tender.
 * @param {import('@tenderpilot/shared').GraphState} state
 * @returns {Promise<object>} partial state - nodes never mutate
 */
export async function ingest(state) {
  const documents = await documentsRepo.findByTender(state.tenderId);
  const pages = [];
  const errors = [];
  const ingested = [];

  for (const document of documents) {
    try {
      const result = await ingestDocument(document);
      ingested.push({
        id: result.documentId,
        kind: document.kind,
        pageCount: result.pages.length,
      });
      for (const page of result.pages) {
        pages.push({ documentId: result.documentId, ...page });
      }
    } catch (error) {
      errors.push({ node: 'ingest', message: error.message });
      logger.error({ filePath: document.filePath, err: error.message }, 'ingest: failed');
    }
  }

  return { documents: ingested, pages, errors };
}
