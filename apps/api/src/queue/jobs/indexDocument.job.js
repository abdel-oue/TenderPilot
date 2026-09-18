/**
 * Indexing job processor. Bootstrap only - the work lives in IndexingService.
 */
import { logger } from '../../lib/logger.js';
import IndexingService from '../../services/indexing.service.js';

let service = null;

/** @returns {IndexingService} built once per worker process */
function getService() {
  if (!service) service = new IndexingService();
  return service;
}

/**
 * @param {{ data: { document: object } }} job the document row, passed whole so
 *   the worker does not re-query for what the api already had
 * @returns {Promise<{ documentId: string, embedded: number }>}
 */
export async function processIndexing(job) {
  const { document } = job.data;
  logger.info({ jobId: job.id, documentId: document.id }, 'job: indexing start');

  const result = await getService().indexDocument(document);

  logger.info({ jobId: job.id, ...result }, 'job: indexing done');
  return result;
}
