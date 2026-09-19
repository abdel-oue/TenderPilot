/**
 * BullMQ queue declarations. One place.
 *
 * Analyses run HERE, in the worker, not in the api process. A full dossier is a
 * minute of OCR and model calls: leaving it as an un-awaited promise in the
 * request handler means an api restart silently loses every run in flight, and
 * nothing retries it.
 */
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { env } from '../lib/env.js';

export const ANALYSIS_QUEUE = 'analysis';
// Indexing a freshly uploaded company document is OCR + embeddings: a minute of
// work that has no business sitting inside the upload request.
export const INDEX_QUEUE = 'index';

// ioredis needs this to be null for BullMQ blocking commands.
export const connection = { url: env.REDIS_URL, maxRetriesPerRequest: null };

const defaultJobOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 50 },
};

export const analysisQueue = new Queue(ANALYSIS_QUEUE, { connection, defaultJobOptions });
export const indexQueue = new Queue(INDEX_QUEUE, { connection, defaultJobOptions });

/**
 * Idempotency key. BullMQ dedupes on jobId natively, so double-clicking
 * "analyser" cannot start the same graph twice. Keyed on the graph version too,
 * so a new graph is a new job rather than a silently skipped duplicate.
 *
 * @param {string} tenderId
 * @param {string} graphVersion
 * @param {string} runId
 * @returns {string}
 */
export function analysisJobId(tenderId, graphVersion, runId) {
  return createHash('sha256')
    .update(tenderId + '|' + graphVersion + '|' + runId)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Deduplicates on the document itself, so uploading the same file twice in a row
 * queues one indexing job, not two.
 *
 * NO COLON. BullMQ rejects a custom job id containing ':' unless it has exactly
 * three segments - it reserves that shape for repeatable jobs - so 'index:<uuid>'
 * threw inside queue.add() and every upload 500'd after the file and the row had
 * already been written. A hyphen carries the same prefix and no meaning to BullMQ.
 *
 * @param {string} documentId
 * @returns {string}
 */
export function indexJobId(documentId) {
  return 'index-' + documentId;
}

/** @returns {Promise<void>} */
export async function closeQueues() {
  await Promise.all([analysisQueue.close(), indexQueue.close()]);
}
