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

// ioredis needs this to be null for BullMQ blocking commands.
export const connection = { url: env.REDIS_URL, maxRetriesPerRequest: null };

const defaultJobOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 50 },
};

export const analysisQueue = new Queue(ANALYSIS_QUEUE, { connection, defaultJobOptions });

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

/** @returns {Promise<void>} */
export async function closeQueues() {
  await analysisQueue.close();
}
