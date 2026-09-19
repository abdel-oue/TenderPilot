/**
 * Analysis Repository
 * ALL analysis run, result and section SQL.
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { analysisResults, analysisRuns, sectionEdits } from '../db/schema/index.js';

export default class AnalysisRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * @param {string} tenderId
   * @param {string} graphVersion
   * @returns {Promise<object>}
   */
  async createRun(tenderId, graphVersion) {
    const [row] = await this.db.insert(analysisRuns).values({ tenderId, graphVersion }).returning();
    return row;
  }

  /**
   * @param {string} runId
   * @returns {Promise<object|undefined>}
   */
  async findRunById(runId) {
    const [row] = await this.db
      .select()
      .from(analysisRuns)
      .where(eq(analysisRuns.id, runId))
      .limit(1);
    return row;
  }

  /**
   * @param {string} tenderId
   * @returns {Promise<object|undefined>} newest run for this tender
   */
  async findLatestRun(tenderId) {
    const [row] = await this.db
      .select()
      .from(analysisRuns)
      .where(eq(analysisRuns.tenderId, tenderId))
      .orderBy(desc(analysisRuns.startedAt))
      .limit(1);
    return row;
  }

  /**
   * Appends one entry to the run trace. The UI polls this: it is the agent
   * activity feed, and it survives a page refresh because it lives here and not
   * in process memory.
   * @param {string} runId
   * @param {{ node: string, at: string, summary: string, status: string }} entry
   * @returns {Promise<void>}
   */
  async appendTrace(runId, entry) {
    const run = await this.findRunById(runId);
    if (!run) return;
    await this.db
      .update(analysisRuns)
      .set({ nodeTrace: [...(run.nodeTrace ?? []), entry] })
      .where(eq(analysisRuns.id, runId));
  }

  /**
   * Parks a question on the run. One nullable column rather than a scan of the
   * trace, so "is this run waiting on me" is answerable by the list screen
   * without loading every entry.
   *
   * @param {string} runId
   * @param {object|null} question pendingQuestionSchema, or null to clear it
   * @returns {Promise<void>}
   */
  async setPendingQuestion(runId, question) {
    await this.db
      .update(analysisRuns)
      .set({ pendingQuestion: question })
      .where(eq(analysisRuns.id, runId));
  }

  /**
   * @param {string} runId
   * @param {{ status?: string, error?: string|null, finishedAt?: Date|null }} patch
   * @returns {Promise<void>}
   */
  async updateRun(runId, patch) {
    await this.db.update(analysisRuns).set(patch).where(eq(analysisRuns.id, runId));
  }

  /**
   * @param {string} runId
   * @param {object} result
   * @returns {Promise<object>}
   */
  async saveResult(runId, result) {
    const [row] = await this.db
      .insert(analysisResults)
      .values({ runId, ...result })
      .onConflictDoUpdate({ target: analysisResults.runId, set: result })
      .returning();
    return row;
  }

  /**
   * @param {string} runId
   * @returns {Promise<object|undefined>}
   */
  async findResultByRun(runId) {
    const [row] = await this.db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.runId, runId))
      .limit(1);
    return row;
  }

  /**
   * @param {string} runId
   * @returns {Promise<object[]>} drafted sections plus any human rewrites
   */
  async findSections(runId) {
    return this.db.select().from(sectionEdits).where(eq(sectionEdits.runId, runId));
  }

  /**
   * EX-06: a correction is kept AND reused. Upsert on (runId, sectionKey).
   *
   * A HUMAN EDIT IS NEVER OVERWRITTEN BY AN AGENT DRAFT. The agent writes with
   * `editedByHuman: false`, and this method refuses that write when the stored
   * row is already a human rewrite: the previous version clobbered the human's
   * text on the very next compliance pass and reset the flag, so a correction
   * survived exactly until the graph touched the section again. The human always
   * wins; only another human edit replaces a human edit.
   *
   * @param {{ runId: string, sectionKey: string, title: string, content: string, editedByHuman: boolean }} values
   * @returns {Promise<object>}
   */
  async upsertSection(values) {
    const existing = (await this.findSections(values.runId)).find(
      (row) => row.sectionKey === values.sectionKey,
    );

    if (!existing) {
      const [row] = await this.db.insert(sectionEdits).values(values).returning();
      return row;
    }

    if (existing.editedByHuman && !values.editedByHuman) return existing;

    const [row] = await this.db
      .update(sectionEdits)
      .set({
        title: values.title,
        content: values.content,
        editedByHuman: values.editedByHuman,
        editedAt: new Date(),
      })
      .where(eq(sectionEdits.id, existing.id))
      .returning();
    return row;
  }

  /**
   * Every human rewrite for a TENDER, across all of its runs, newest first.
   *
   * Section edits are keyed on runId, and re-analysing a dossier mints a new run
   * - so a correction made on Monday was invisible to Tuesday's analysis, which
   * is not what "la correction est reprise dans les etapes suivantes" means. The
   * join is the fix: no migration, and a correction now outlives the run it was
   * made in.
   *
   * @param {string} tenderId
   * @returns {Promise<object[]>}
   */
  async findHumanEditsForTender(tenderId) {
    return this.db
      .select({
        sectionKey: sectionEdits.sectionKey,
        title: sectionEdits.title,
        content: sectionEdits.content,
        editedAt: sectionEdits.editedAt,
        runId: sectionEdits.runId,
      })
      .from(sectionEdits)
      .innerJoin(analysisRuns, eq(analysisRuns.id, sectionEdits.runId))
      .where(and(eq(analysisRuns.tenderId, tenderId), eq(sectionEdits.editedByHuman, true)))
      .orderBy(desc(sectionEdits.editedAt));
  }
}
