/**
 * LLM Usage Repository
 * ALL token-usage SQL. Feeds the usage dashboard.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { llmUsage } from '../db/schema/index.js';

export default class UsageRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * @param {object} entry one LLM or embedding call
   * @returns {Promise<void>}
   */
  async record(entry) {
    await this.db.insert(llmUsage).values(entry);
  }

  /**
   * Per-request totals: the "token usage per request" the dashboard is built on.
   * @param {{ since?: Date, limit?: number }} [options]
   * @returns {Promise<object[]>}
   */
  async summarizeByRequest({ since, limit = 50 } = {}) {
    const rows = await this.db
      .select({
        requestId: llmUsage.requestId,
        runId: llmUsage.runId,
        calls: sql`count(*)::int`,
        promptTokens: sql`coalesce(sum(${llmUsage.promptTokens}), 0)::int`,
        completionTokens: sql`coalesce(sum(${llmUsage.completionTokens}), 0)::int`,
        totalTokens: sql`coalesce(sum(${llmUsage.totalTokens}), 0)::int`,
        latencyMs: sql`coalesce(sum(${llmUsage.latencyMs}), 0)::int`,
        errors: sql`count(*) filter (where ${llmUsage.status} = 'error')::int`,
        startedAt: sql`min(${llmUsage.createdAt})`,
      })
      .from(llmUsage)
      .where(since ? gte(llmUsage.createdAt, since) : undefined)
      .groupBy(llmUsage.requestId, llmUsage.runId)
      .orderBy(desc(sql`min(${llmUsage.createdAt})`))
      .limit(limit);
    return rows;
  }

  /**
   * Spend per model. This is what shows whether gpt-5.5 is being used where it
   * earns its cost, or everywhere.
   * @param {{ since?: Date }} [options]
   * @returns {Promise<object[]>}
   */
  async summarizeByModel({ since } = {}) {
    return this.db
      .select({
        tier: llmUsage.tier,
        model: llmUsage.model,
        calls: sql`count(*)::int`,
        promptTokens: sql`coalesce(sum(${llmUsage.promptTokens}), 0)::int`,
        completionTokens: sql`coalesce(sum(${llmUsage.completionTokens}), 0)::int`,
        totalTokens: sql`coalesce(sum(${llmUsage.totalTokens}), 0)::int`,
        avgLatencyMs: sql`coalesce(round(avg(${llmUsage.latencyMs})), 0)::int`,
      })
      .from(llmUsage)
      .where(since ? gte(llmUsage.createdAt, since) : undefined)
      .groupBy(llmUsage.tier, llmUsage.model)
      .orderBy(desc(sql`sum(${llmUsage.totalTokens})`));
  }

  /**
   * Spend per agent/node, so an expensive prompt is attributable.
   *
   * `runId` is what the Controle screen filters on. It is also the ONLY scoping
   * this table has: llm_usage carries no ownerId, so a caller must have checked
   * that the run belongs to the user before asking for its usage.
   *
   * @param {{ since?: Date, runId?: string }} [options]
   * @returns {Promise<object[]>}
   */
  async summarizeByOperation({ since, runId } = {}) {
    return this.db
      .select({
        operation: llmUsage.operation,
        tier: llmUsage.tier,
        model: sql`min(${llmUsage.model})`,
        calls: sql`count(*)::int`,
        promptTokens: sql`coalesce(sum(${llmUsage.promptTokens}), 0)::int`,
        completionTokens: sql`coalesce(sum(${llmUsage.completionTokens}), 0)::int`,
        totalTokens: sql`coalesce(sum(${llmUsage.totalTokens}), 0)::int`,
        avgLatencyMs: sql`coalesce(round(avg(${llmUsage.latencyMs})), 0)::int`,
        errors: sql`count(*) filter (where ${llmUsage.status} = 'error')::int`,
      })
      .from(llmUsage)
      .where(
        and(
          since ? gte(llmUsage.createdAt, since) : undefined,
          runId ? eq(llmUsage.runId, runId) : undefined,
        ),
      )
      .groupBy(llmUsage.operation, llmUsage.tier)
      .orderBy(desc(sql`sum(${llmUsage.totalTokens})`));
  }

  /**
   * @param {string} requestId
   * @returns {Promise<object[]>} every call made while serving one request
   */
  async findByRequest(requestId) {
    return this.db
      .select()
      .from(llmUsage)
      .where(and(sql`${llmUsage.requestId} = ${requestId}`))
      .orderBy(llmUsage.createdAt);
  }

  /**
   * @param {{ since?: Date }} [options]
   * @returns {Promise<{ calls: number, totalTokens: number, promptTokens: number, completionTokens: number, errors: number }>}
   */
  async totals({ since } = {}) {
    const [row] = await this.db
      .select({
        calls: sql`count(*)::int`,
        promptTokens: sql`coalesce(sum(${llmUsage.promptTokens}), 0)::int`,
        completionTokens: sql`coalesce(sum(${llmUsage.completionTokens}), 0)::int`,
        totalTokens: sql`coalesce(sum(${llmUsage.totalTokens}), 0)::int`,
        errors: sql`count(*) filter (where ${llmUsage.status} = 'error')::int`,
      })
      .from(llmUsage)
      .where(since ? gte(llmUsage.createdAt, since) : undefined);
    return row;
  }
}
