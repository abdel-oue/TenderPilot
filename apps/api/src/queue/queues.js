// BullMQ queue declarations. One place.
//
// TODO: ingestQueue, analysisQueue
// TODO: default job options - attempts, exponential backoff, removeOnComplete
// TODO: every add() passes an idempotency jobId: hash(tenderId + stage + graphVersion).
//       BullMQ dedupes on jobId natively. One line, removes a whole class of bug.
