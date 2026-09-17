import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../lib/env.js';
import * as schema from './schema/index.js';

const sql = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(sql, { schema });

/** Closes the pool. Called on graceful shutdown. @returns {Promise<void>} */
export async function closeDb() {
  await sql.end({ timeout: 5 });
}
