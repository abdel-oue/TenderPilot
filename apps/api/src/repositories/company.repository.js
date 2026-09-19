/**
 * Company Repository
 * ALL company profile SQL.
 *
 * ONE COMPANY PER USER: every method takes an ownerId and every row carries one.
 * A second user signing up sees an empty company - no profile, no references, no
 * team - until they import their own.
 *
 * The business keys (REF-01, CV-01) are unique WITHIN an owner, which is what
 * keeps the seed idempotent without a TRUNCATE while letting two users both hold
 * a "REF-01" of their own.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { companyProfile, companyReferences, teamMembers } from '../db/schema/index.js';

export default class CompanyRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * @param {string} ownerId
   * @returns {Promise<object|undefined>} undefined until this user imports a profile
   */
  async getProfile(ownerId) {
    const [row] = await this.db
      .select()
      .from(companyProfile)
      .where(eq(companyProfile.ownerId, ownerId))
      .limit(1);
    return row;
  }

  /**
   * @param {string} ownerId
   * @returns {Promise<object[]>} every reference, REF-01 first
   */
  async findAllReferences(ownerId) {
    return this.db
      .select()
      .from(companyReferences)
      .where(eq(companyReferences.ownerId, ownerId))
      .orderBy(companyReferences.id);
  }

  /**
   * @param {string} ownerId
   * @returns {Promise<object[]>} every team member, CV-01 first
   */
  async findAllTeam(ownerId) {
    return this.db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.ownerId, ownerId))
      .orderBy(teamMembers.id);
  }

  /**
   * @param {object} values must carry ownerId - it is the primary key
   * @returns {Promise<void>}
   */
  async upsertProfile(values) {
    await this.db
      .insert(companyProfile)
      .values(values)
      .onConflictDoUpdate({ target: companyProfile.ownerId, set: values });
  }

  /**
   * @param {object[]} rows keyed on (ownerId, REF-xx)
   * @returns {Promise<void>}
   */
  async upsertReferences(rows) {
    for (const row of rows) {
      await this.db
        .insert(companyReferences)
        .values(row)
        .onConflictDoUpdate({
          target: [companyReferences.ownerId, companyReferences.id],
          set: row,
        });
    }
  }

  /**
   * @param {object[]} rows keyed on (ownerId, CV-xx)
   * @returns {Promise<void>}
   */
  async upsertTeamMembers(rows) {
    for (const row of rows) {
      await this.db
        .insert(teamMembers)
        .values(row)
        .onConflictDoUpdate({ target: [teamMembers.ownerId, teamMembers.id], set: row });
    }
  }
}
