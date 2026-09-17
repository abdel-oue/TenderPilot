/**
 * Tender Repository
 * ALL tender SQL. A query written outside a repository is a bug.
 */
import { desc, eq } from 'drizzle-orm';
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

  /** @returns {Promise<object[]>} newest first */
  async findAll() {
    return this.db.select(COLUMNS).from(tenders).orderBy(desc(tenders.createdAt));
  }

  /**
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async findById(id) {
    const [row] = await this.db.select(COLUMNS).from(tenders).where(eq(tenders.id, id)).limit(1);
    return row;
  }

  /**
   * @param {string} reference AO-2026-0XX
   * @returns {Promise<object|undefined>}
   */
  async findByReference(reference) {
    const [row] = await this.db
      .select(COLUMNS)
      .from(tenders)
      .where(eq(tenders.reference, reference))
      .limit(1);
    return row;
  }

  /**
   * Upserts on the AO reference - the seed's idempotency key.
   * @param {{ reference: string, title?: string|null, buyer?: string|null, status?: string }} values
   * @returns {Promise<object>}
   */
  async upsert(values) {
    const [row] = await this.db
      .insert(tenders)
      .values(values)
      .onConflictDoUpdate({ target: tenders.reference, set: { title: values.title ?? null } })
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
