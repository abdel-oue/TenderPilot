/**
 * BullMQ worker bootstrap ONLY. Same image as the api, different command.
 */
import { Worker } from 'bullmq';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { closeDb } from './db/client.js';
import { ANALYSIS_QUEUE, INDEX_QUEUE, connection, closeQueues } from './queue/queues.js';
import { processAnalysis } from './queue/jobs/analyzeTender.job.js';
import { processIndexing } from './queue/jobs/indexDocument.job.js';

// One dossier at a time per worker. The shared model quota is the bottleneck,
// not this process, and a burst of concurrent analyses would just rate-limit
// each other while making every one of them slower.
const CONCURRENCY = Number(process.env.ANALYSIS_CONCURRENCY ?? 1);

// Two queues, one process. Indexing runs on its own queue so a freshly uploaded
// attestation is not stuck behind a ten-minute dossier analysis - the upload the
// user just made is exactly what they are waiting to see finish.
const workers = [
  new Worker(ANALYSIS_QUEUE, processAnalysis, { connection, concurrency: CONCURRENCY }),
  new Worker(INDEX_QUEUE, processIndexing, { connection, concurrency: CONCURRENCY }),
];

for (const worker of workers) {
  worker.on('completed', (job, result) =>
    logger.info({ jobId: job.id, ...result }, 'worker: job completed'),
  );
  worker.on('failed', (job, error) =>
    logger.error({ jobId: job?.id, err: error?.message }, 'worker: job failed'),
  );
}

logger.info(
  { queues: [ANALYSIS_QUEUE, INDEX_QUEUE], concurrency: CONCURRENCY, env: env.NODE_ENV },
  'worker: ready',
);

// Drain in flight jobs rather than abandoning a dossier mid-analysis.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    logger.info({ signal }, 'worker: draining');
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    await closeDb();
    process.exit(0);
  });
}
