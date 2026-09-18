// Indexing entry point: `npm run db:index`. Bootstrap only.
//
// Separate from the seed on purpose. The seed REGISTERS the company documents
// (a row and a hash, instant, idempotent); this EMBEDS them, which is OCR plus
// embedding calls - real quota and real minutes. Folding it into the seed would
// mean every container restart paid for it again.
//
// Safe to re-run: only chunks with a NULL embedding are touched, so a second run
// on an already-indexed corpus costs one query.
//
// Indexes the demo user's corpus by default, or the user whose email is passed:
//   npm run db:index -- someone@example.com

import { closeDb } from './client.js';
import { logger } from '../lib/logger.js';
import IndexingService from '../services/indexing.service.js';
import UserRepository from '../repositories/user.repository.js';

const DEFAULT_EMAIL = 'demo@tenderpilot.local';

/** @returns {Promise<void>} */
async function main() {
  const email = (process.argv[2] ?? DEFAULT_EMAIL).toLowerCase();
  const user = await new UserRepository().findByEmailWithHash(email);
  if (!user) throw new Error(`no user with email ${email} - run db:seed first`);

  logger.info({ email }, 'index: starting');
  const summary = await new IndexingService().indexCompanyCorpus(user.id);

  if (summary.embedded === 0 && summary.documents > 0) {
    // Not an error - it is what an already-indexed corpus looks like - but worth
    // saying out loud, because "0 embedded" is also what a broken run looks like.
    logger.info('index: nothing new to embed, corpus already indexed');
  }
  logger.info({ ...summary, failed: summary.failed.length }, 'index: done');
}

try {
  await main();
} catch (error) {
  logger.error({ err: error.message }, 'index failed');
  process.exitCode = 1;
} finally {
  await closeDb();
}
