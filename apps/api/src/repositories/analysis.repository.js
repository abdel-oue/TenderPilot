/**
 * Analysis Repository
 * ALL analysis run, result and section SQL.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { analysisResults, analysisRuns, llmUsage, sectionEdits, tenders } from '../db/schema/index.js';

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
   * Every run this user owns, newest first - the Controle screen.
   *
   * analysis_runs carries no ownerId (it hangs off the tender), and llm_usage
   * carries none either, so BOTH scopings happen here: the inner join to tenders
   * is the ownership filter, and the token totals are a correlated subquery on
   * run_id rather than a join, so a run with no LLM call still appears with 0.
   *
   * node_trace is not selected: a list of fifty runs does not need fifty full
   * traces, only how many steps each one took. The trace is read per run by
   * findRunById when a row is expanded.
   *
   * @param {string} ownerId
   * @param {{ limit?: number }} [options]
   * @returns {Promise<object[]>}
   */
  async listRunsForOwner(ownerId, { limit = 50 } = {}) {
    return this.db
      .select({
        runId: analysisRuns.id,
        tenderId: analysisRuns.tenderId,
        reference: tenders.reference,
        title: tenders.title,
        status: analysisRuns.status,
        graphVersion: analysisRuns.graphVersion,
        startedAt: analysisRuns.startedAt,
        finishedAt: analysisRuns.finishedAt,
        error: analysisRuns.error,
        awaiting: sql`(${analysisRuns.pendingQuestion} is not null)`,
        steps: sql`jsonb_array_length(${analysisRuns.nodeTrace})::int`,
        totalTokens: sql`(select coalesce(sum(u.total_tokens), 0)::int from ${llmUsage} u where u.run_id = ${analysisRuns.id})`,
        calls: sql`(select count(*)::int from ${llmUsage} u where u.run_id = ${analysisRuns.id})`,
      })
      .from(analysisRuns)
      .innerJoin(tenders, eq(tenders.id, analysisRuns.tenderId))
      .where(eq(tenders.ownerId, ownerId))
      .orderBy(desc(analysisRuns.startedAt))
      .limit(limit);
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
    await this.db
      .update(analysisRuns)
      .set({ nodeTrace: sql`coalesce(${analysisRuns.nodeTrace}, '[]'::jsonb) || ${JSON.stringify([entry])}::jsonb` })
      .where(eq(analysisRuns.id, runId));
  }

  async updateTrace(runId, entry) {
    await this.db.update(analysisRuns).set({
      nodeTrace: sql`(select jsonb_agg(case when item->>'id' = ${entry.id} then ${JSON.stringify(entry)}::jsonb else item end order by position)
        from jsonb_array_elements(${analysisRuns.nodeTrace}) with ordinality as trace(item, position))`,
    }).where(eq(analysisRuns.id, runId));
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
   * @param {{ runId: string, sectionKey: string, title: string, content: string, editedByHuman: boolean, complianceWarnings?: object[], needsHuman?: boolean }} values
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
        validatedByHuman: values.validatedByHuman ?? false,
        complianceWarnings: values.complianceWarnings ?? [],
        needsHuman: values.needsHuman ?? false,
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
    const rows = await this.db
      .select({
        sectionKey: sectionEdits.sectionKey,
        title: sectionEdits.title,
        content: sectionEdits.content,
        editedAt: sectionEdits.editedAt,
        runId: sectionEdits.runId,
        validatedByHuman: sectionEdits.validatedByHuman,
        complianceWarnings: sectionEdits.complianceWarnings,
      })
      .from(sectionEdits)
      .innerJoin(analysisRuns, eq(analysisRuns.id, sectionEdits.runId))
      .where(and(eq(analysisRuns.tenderId, tenderId), eq(sectionEdits.editedByHuman, true)))
      .orderBy(desc(sectionEdits.editedAt));
    const newest = new Map();
    for (const row of rows) if (!newest.has(row.sectionKey)) newest.set(row.sectionKey, row);
    return [...newest.values()];
  }
}
