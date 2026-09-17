/**
 * LLM Service
 * The single boundary every agent calls. Owns three things and nothing else:
 *
 *   1. MODEL ROUTING. Two tiers, and picking wrongly is both a cost and a graded
 *      architecture decision. 'reasoning' (gpt-5.5) is for orchestration and the
 *      decisions that actually weigh evidence; 'volume' (gpt-4.1) is for
 *      extraction, classification, drafting and reformatting. Volume is the
 *      default, so reaching for the expensive tier is a deliberate act.
 *   2. THE SCHEMA CONTRACT. Nothing returns a model response that has not been
 *      through zod. One repair attempt with the errors fed back, then fail loud.
 *   3. USAGE ACCOUNTING. Every call, success or failure, becomes an llm_usage row
 *      attributed to the request that caused it.
 */
import { env } from '../lib/env.js';
import { appError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getContext } from '../lib/requestContext.js';
import UsageRepository from '../repositories/usage.repository.js';
import AzureOpenAiService from './azureOpenai.service.js';

export const TIERS = { REASONING: 'reasoning', VOLUME: 'volume' };

export default class LlmService {
  /**
   * @param {object} [deps]
   * @param {AzureOpenAiService} [deps.reasoning]
   * @param {AzureOpenAiService} [deps.volume]
   * @param {UsageRepository} [deps.usageRepository]
   * @param {boolean} [deps.stub] force stub mode regardless of env
   */
  constructor({ reasoning, volume, usageRepository, stub } = {}) {
    this.stub = stub ?? env.STUB_LLM;
    this.usage = usageRepository ?? new UsageRepository();

    // Clients are not built in stub mode: a test machine has no real keys, and
    // constructing a client that can never be used only creates a way to fail.
    if (this.stub) {
      this.providers = { [TIERS.REASONING]: reasoning, [TIERS.VOLUME]: volume };
      return;
    }

    this.providers = {
      [TIERS.REASONING]:
        reasoning ??
        new AzureOpenAiService({
          tier: TIERS.REASONING,
          apiKey: env.LLM_API_KEY,
          model: env.LLM_MODEL,
          baseURL: env.LLM_URL,
          // gpt-5.5 only accepts its default sampling temperature.
          supportsTemperature: false,
        }),
      [TIERS.VOLUME]:
        volume ??
        new AzureOpenAiService({
          tier: TIERS.VOLUME,
          apiKey: env.AZURE_OPENAI_API_KEY,
          model: env.AZURE_OPENAI_DEPLOYMENT_NAME,
          endpoint: env.AZURE_OPENAI_ENDPOINT,
          apiVersion: env.AZURE_OPENAI_API_VERSION,
          maxTokens: env.AZURE_OPENAI_MAX_TOKENS,
        }),
    };
  }

  /**
   * Writes one usage row. Never throws: losing an accounting row must not fail
   * the request that earned it.
   * @param {object} entry
   * @returns {Promise<void>}
   */
  async recordUsage(entry) {
    const context = getContext();
    try {
      await this.usage.record({
        requestId: context.requestId,
        runId: context.runId,
        tenderId: context.tenderId,
        ...entry,
      });
    } catch (error) {
      logger.warn({ err: error.message }, 'llm: usage row not recorded');
    }
  }

  /**
   * @param {string} content
   * @returns {unknown} undefined when the payload is not JSON at all
   */
  static parseJson(content) {
    try {
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  /**
   * Calls a model and returns a value already parsed by the caller zod schema.
   *
   * @param {object} options
   * @param {string} options.name the agent or node spending the tokens
   * @param {string} options.system
   * @param {string} options.user
   * @param {import('zod').ZodType} options.schema
   * @param {'reasoning'|'volume'} [options.tier] defaults to the cheap tier
   * @param {unknown} [options.stub] returned when stub mode is on
   * @param {number} [options.temperature]
   * @param {number} [options.maxTokens]
   * @returns {Promise<unknown>} the parsed value
   */
  async complete(options) {
    const { name, system, user, schema, tier = TIERS.VOLUME, stub, temperature = 0, maxTokens } = options;

    if (this.stub) return this.completeFromStub({ name, schema, stub, tier });

    const provider = this.providers[tier];
    if (!provider) throw appError('Unknown model tier: ' + tier, 'UNKNOWN_TIER', 500);

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let result;
      try {
        result = await provider.chatJson({ messages, temperature, maxTokens });
      } catch (error) {
        await this.recordUsage({
          tier,
          model: provider.model,
          operation: name,
          latencyMs: 0,
          status: 'error',
          error: error.message,
        });
        throw appError('Le modele n a pas repondu (' + name + ').', 'LLM_REQUEST_FAILED', 502);
      }

      await this.recordUsage({
        tier,
        model: result.model,
        operation: name,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        latencyMs: result.latencyMs,
        status: 'ok',
      });

      logger.info(
        { name, tier, attempt, model: result.model, ...result.usage, latencyMs: result.latencyMs },
        'llm: call',
      );

      const parsed = schema.safeParse(LlmService.parseJson(result.content));
      if (parsed.success) return parsed.data;

      const issues = parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ');
      logger.warn({ name, attempt, issues }, 'llm: schema validation failed');

      if (attempt === 2) {
        throw appError(
          'Reponse du modele non conforme au schema (' + name + ').',
          'SCHEMA_VALIDATION_FAILED',
          502,
        );
      }

      // One repair attempt, with the failure fed back. Never retry forever,
      // never silently substitute a default.
      messages.push({ role: 'assistant', content: result.content });
      messages.push({
        role: 'user',
        content:
          'Your previous answer did not match the required JSON shape. ' +
          'Fix exactly these problems and reply with JSON only: ' +
          issues,
      });
    }

    throw appError('unreachable', 'SCHEMA_VALIDATION_FAILED', 502);
  }

  /**
   * Embeds text for pgvector search. Embeddings are computed once and stored;
   * nothing re-indexes per request.
   * @param {string[]} inputs
   * @param {{ name?: string }} [options]
   * @returns {Promise<number[][]>}
   */
  async embed(inputs, options = {}) {
    const name = options.name ?? 'embed';
    if (inputs.length === 0) return [];

    if (this.stub) {
      // Deterministic, correctly sized vectors, so the pgvector code paths stay
      // exercisable offline without pretending to be semantically meaningful.
      return inputs.map((input) =>
        Array.from({ length: env.EMBEDDING_DIMENSIONS }, (_, i) =>
          Math.sin(((input.length + i) % 97) / 97),
        ),
      );
    }

    const provider = this.providers[TIERS.REASONING];
    const result = await provider.embed(inputs, env.EMBEDDING_MODEL, env.EMBEDDING_DIMENSIONS);

    await this.recordUsage({
      tier: 'embedding',
      model: result.model,
      operation: name,
      promptTokens: result.usage.promptTokens,
      completionTokens: 0,
      totalTokens: result.usage.totalTokens,
      latencyMs: result.latencyMs,
      status: 'ok',
    });

    return result.vectors;
  }

  /**
   * Stub mode still validates, and still records a zero-token usage row, so the
   * dashboard and the E2E path are exercised rather than bypassed.
   * @param {{ name: string, schema: import('zod').ZodType, stub: unknown, tier: string }} options
   * @returns {Promise<unknown>}
   */
  async completeFromStub({ name, schema, stub, tier }) {
    if (stub === undefined) {
      throw appError('STUB_LLM is on but ' + name + ' has no stub', 'MISSING_STUB', 500);
    }
    const parsed = schema.safeParse(stub);
    if (!parsed.success) {
      // A stub that does not satisfy its own schema is a bug in the test, and a
      // silent one if it is allowed through.
      throw appError('Stub for ' + name + ' does not match its schema', 'INVALID_STUB', 500);
    }
    await this.recordUsage({ tier, model: 'stub', operation: name, latencyMs: 0, status: 'ok' });
    return parsed.data;
  }
}
