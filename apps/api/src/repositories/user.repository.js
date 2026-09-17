/**
 * User Repository
 * ALL user SQL. Auth is out of scope per the cahier des charges and stays as it
 * is: login only, no roles, no reset flow.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';

// The hash only leaves the DB where it is actually needed.
const PUBLIC_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  createdAt: users.createdAt,
};

export default class UserRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * @param {string} email lowercased
   * @returns {Promise<object|undefined>} includes passwordHash
   */
  async findByEmailWithHash(email) {
    const [row] = await this.db
      .select({ ...PUBLIC_COLUMNS, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row;
  }

  /**
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async findById(id) {
    const [row] = await this.db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  /**
   * @param {{ email: string, name: string, passwordHash: string }} values
   * @returns {Promise<object|undefined>} undefined when the email already exists
   */
  async insert(values) {
    const [row] = await this.db
      .insert(users)
      .values(values)
      .onConflictDoNothing({ target: users.email })
      .returning(PUBLIC_COLUMNS);
    return row;
  }
}
