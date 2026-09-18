/**
 * Tender Repository
 * ALL tender SQL. A query written outside a repository is a bug.
 *
 * EVERY read takes an ownerId and filters on it. Scoping in the repository
 * rather than in each service means there is no query that can accidentally
 * return another user's dossiers - the filter is not something a caller can
 * forget to pass, because it is a required argument.
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tenders } from '../db/schema/index.js';

// Explicit projection: never a bare select() on a table that will grow.
const COLUMNS = {
  id: tenders.id,
  reference: tenders.reference,
  title: tenders.title,
  buyer: tenders.buyer,
  deadline: tenders.deadline,
  estimatedValue: tenders.estimatedValue,
  status: tenders.status,
  createdAt: tenders.createdAt,
};

export default class TenderRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * @param {string} ownerId
   * @returns {Promise<object[]>} newest first
   */
  async findAll(ownerId) {
    return this.db
      .select(COLUMNS)
      .from(tenders)
      .where(eq(tenders.ownerId, ownerId))
      .orderBy(desc(tenders.createdAt));
  }

  /**
   * Returns undefined for a tender that exists but belongs to someone else, so
   * the service maps it to 404 - "not yours" and "not there" look identical from
   * the outside, which is the correct answer to both.
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<object|undefined>}
   */
  async findById(id, ownerId) {
    const [row] = await this.db
      .select(COLUMNS)
      .from(tenders)
      .where(and(eq(tenders.id, id), eq(tenders.ownerId, ownerId)))
      .limit(1);
    return row;
  }

  /**
   * @param {string} reference AO-2026-0XX
   * @param {string} ownerId
   * @returns {Promise<object|undefined>}
   */
  async findByReference(reference, ownerId) {
    const [row] = await this.db
      .select(COLUMNS)
      .from(tenders)
      .where(and(eq(tenders.reference, reference), eq(tenders.ownerId, ownerId)))
      .limit(1);
    return row;
  }

  /**
   * Upserts on (ownerId, reference) - the seed's idempotency key, and the reason
   * two users can both hold AO-2026-004 without colliding.
   * @param {{ ownerId: string, reference: string, title?: string|null, buyer?: string|null, status?: string }} values
   * @returns {Promise<object>}
   */
  async upsert(values) {
    const [row] = await this.db
      .insert(tenders)
      .values(values)
      .onConflictDoUpdate({
        target: [tenders.ownerId, tenders.reference],
        set: { title: values.title ?? null },
      })
      .returning(COLUMNS);
    return row;
  }

  /**
   * @param {string} id
   * @param {string} status
   * @returns {Promise<void>}
   */
  async updateStatus(id, status) {
    await this.db.update(tenders).set({ status }).where(eq(tenders.id, id));
  }
}
