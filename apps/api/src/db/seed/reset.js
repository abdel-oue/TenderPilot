// npm run db:reset ONLY. Never imported by the seed, by startup, by compose,
// or by any test setup helper. Guard first, work second.

import postgres from 'postgres';
import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres'];

/** @returns {void} throws unless the target is unmistakably a local/compose DB */
function assertSafeTarget() {
  if (env.NODE_ENV === 'production') {
    throw new Error('db:reset refuses to run with NODE_ENV=production');
  }
  const hostname = new URL(env.DATABASE_URL).hostname;
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error('db:reset refuses to run against a non-local host: ' + hostname);
  }
}

assertSafeTarget();

const sql = postgres(env.DATABASE_URL, { max: 1 });
try {
  logger.warn({ host: new URL(env.DATABASE_URL).hostname }, 'db:reset - dropping schema public');
  await sql.unsafe('drop schema public cascade; create schema public;');
  await sql.unsafe('create extension if not exists vector;');
  await sql.unsafe('create extension if not exists pgcrypto;');
  logger.info('db:reset done - run db:migrate then db:seed');
} finally {
  await sql.end({ timeout: 5 });
}
