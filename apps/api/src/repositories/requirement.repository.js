/**
 * Requirement Repository
 * ALL requirement + rubric SQL.
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { requirements, rubricCriteria } from '../db/schema/index.js';

export default class RequirementRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * @param {string} tenderId
   * @returns {Promise<object[]>} in page order, so the UI reads like the document
   */
  async findByTender(tenderId) {
    return this.db
      .select()
      .from(requirements)
      .where(eq(requirements.tenderId, tenderId))
      .orderBy(asc(requirements.sourcePage));
  }

  /**
   * @param {string} tenderId
   * @returns {Promise<object[]>} only the ones that can disqualify outright
   */
  async findEliminatoryByTender(tenderId) {
    const rows = await this.findByTender(tenderId);
    return rows.filter((row) => row.obligation === 'eliminatoire');
  }

  /**
   * @param {object[]} rows
   * @returns {Promise<object[]>}
   */
  async insertMany(rows) {
    if (rows.length === 0) return [];
    return this.db.insert(requirements).values(rows).returning();
  }

  /**
   * @param {string} id
   * @param {string} obligation
   * @returns {Promise<void>}
   */
  async updateObligation(id, obligation) {
    await this.db.update(requirements).set({ obligation }).where(eq(requirements.id, id));
  }

  /**
   * Scoped to one tender on purpose. A re-run must not stack duplicates, and it
   * must never touch another tender's rows.
   * @param {string} tenderId
   * @returns {Promise<void>}
   */
  async deleteByTender(tenderId) {
    await this.db.delete(requirements).where(eq(requirements.tenderId, tenderId));
  }

  /**
   * @param {string} tenderId
   * @returns {Promise<object[]>}
   */
  async findRubricByTender(tenderId) {
    return this.db.select().from(rubricCriteria).where(eq(rubricCriteria.tenderId, tenderId));
  }

  /**
   * @param {object[]} rows
   * @returns {Promise<void>}
   */
  async insertRubric(rows) {
    if (rows.length === 0) return;
    await this.db.insert(rubricCriteria).values(rows);
  }

  /**
   * @param {string} tenderId
   * @returns {Promise<void>}
   */
  async deleteRubricByTender(tenderId) {
    await this.db.delete(rubricCriteria).where(eq(rubricCriteria.tenderId, tenderId));
  }
}
