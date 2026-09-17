/**
 * Company Repository
 * ALL company profile SQL. The text primary keys (REF-01, CV-01) ARE the seed
 * business keys - that is what makes the seed idempotent without a TRUNCATE.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { companyProfile, companyReferences, teamMembers } from '../db/schema/index.js';

export default class CompanyRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /** @returns {Promise<object|undefined>} the single profile row */
  async getProfile() {
    const [row] = await this.db.select().from(companyProfile).limit(1);
    return row;
  }

  /** @returns {Promise<object[]>} every reference, REF-01 first */
  async findAllReferences() {
    return this.db.select().from(companyReferences).orderBy(companyReferences.id);
  }

  /**
   * @param {string} secteur
   * @returns {Promise<object[]>}
   */
  async findReferencesBySector(secteur) {
    return this.db.select().from(companyReferences).where(eq(companyReferences.secteur, secteur));
  }

  /** @returns {Promise<object[]>} every team member, CV-01 first */
  async findAllTeam() {
    return this.db.select().from(teamMembers).orderBy(teamMembers.id);
  }

  /**
   * @param {object} values
   * @returns {Promise<void>}
   */
  async upsertProfile(values) {
    await this.db
      .insert(companyProfile)
      .values(values)
      .onConflictDoUpdate({ target: companyProfile.ice, set: values });
  }

  /**
   * @param {object[]} rows keyed on REF-xx
   * @returns {Promise<void>}
   */
  async upsertReferences(rows) {
    for (const row of rows) {
      await this.db
        .insert(companyReferences)
        .values(row)
        .onConflictDoUpdate({ target: companyReferences.id, set: row });
    }
  }

  /**
   * @param {object[]} rows keyed on CV-xx
   * @returns {Promise<void>}
   */
  async upsertTeamMembers(rows) {
    for (const row of rows) {
      await this.db
        .insert(teamMembers)
        .values(row)
        .onConflictDoUpdate({ target: teamMembers.id, set: row });
    }
  }
}
