import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const MIGRATIONS_FOLDER = join(import.meta.dirname, 'migrations');

/**
 * Applies pending migrations. Run on api startup and by `npm run db:migrate`.
 * @returns {Promise<void>}
 */
export async function runMigrations() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
    logger.info({ folder: MIGRATIONS_FOLDER }, 'migrations applied');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Direct `node src/db/migrate.js` run.
if (process.argv[1] === import.meta.filename) {
  try {
    await runMigrations();
  } catch (error) {
    logger.error({ error }, 'migrations failed');
    process.exit(1);
  }
}
