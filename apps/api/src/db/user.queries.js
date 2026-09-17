import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { users } from './schema/index.js';

// Explicit projection everywhere: the hash only leaves the DB where it is needed.
const PUBLIC_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  createdAt: users.createdAt,
};

/**
 * @param {string} email lowercased
 * @returns {Promise<{ id: string, email: string, name: string, createdAt: Date, passwordHash: string } | undefined>}
 */
export async function findByEmailWithHash(email) {
  const [row] = await db
    .select({ ...PUBLIC_COLUMNS, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row;
}

/**
 * @param {string} id
 * @returns {Promise<{ id: string, email: string, name: string, createdAt: Date } | undefined>}
 */
export async function findById(id) {
  const [row] = await db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, id)).limit(1);
  return row;
}

/**
 * Inserts a user, doing nothing when the email is already taken.
 * @param {{ email: string, name: string, passwordHash: string }} values
 * @returns {Promise<{ id: string, email: string, name: string, createdAt: Date } | undefined>} undefined when the email exists
 */
export async function insertUser(values) {
  const [row] = await db.insert(users).values(values).onConflictDoNothing({ target: users.email }).returning(PUBLIC_COLUMNS);
  return row;
}
