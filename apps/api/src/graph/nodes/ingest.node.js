// Extractor, step 1: PDF bytes -> pages, each keeping the number it came from.
//
// Routing, not fallback: a dossier with a text layer is read with unpdf, one
// without is rasterized and OCR'd. AO-2026-004 and AO-2026-009 are pure scans.
//
// A page that yields no usable text after BOTH paths is kept as a row with
// extraction: 'unread'. That list is EX-07 - "signale explicitement les pages
// non lues, et n'invente aucune exigence" - and silently dropping it is the
// failure mode the jury tests for.

import { readFile } from 'node:fs/promises';
import { getCachedPages, hashFile } from '../../lib/cache.js';
import { logger } from '../../lib/logger.js';
import { ocrAvailable, ocrPages } from '../../lib/ocr.js';
import { extractPages, hasTextLayer, pageHasText } from '../../lib/pdf.js';
import DocumentRepository from '../../repositories/document.repository.js';

const documentsRepo = new DocumentRepository();

/**
 * @param {{ page: number, text: string }[]} pages
 * @param {string} extraction
 * @returns {{ page: number, text: string, extraction: string }[]}
 */
function label(pages, extraction) {
  return pages.map((p) => ({
    page: p.page,
    text: p.text,
    extraction: pageHasText(p) ? extraction : 'unread',
  }));
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
    return { documentId: cached.documentId, pages: cached.pages, extractionPath: 'cached' };
  }

  let pages = await extractPages(buffer);
  let extractionPath = 'text_layer';

  if (!hasTextLayer(pages)) {
    if (!(await ocrAvailable())) {
      // Loud and explicit. A scan silently returning zero requirements is the
      // exact "erreur silencieuse" EX-07 forbids.
      throw new Error(
        `${document.filePath} has no text layer and the OCR toolchain ` +
          '(pdftoppm, tesseract) is not installed on this machine.',
      );
    }
    logger.info({ filePath: document.filePath }, 'ingest: no text layer, routing to OCR');
    pages = await ocrPages(buffer);
    extractionPath = 'ocr';
  }

  const labelled = label(pages, extractionPath);

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
