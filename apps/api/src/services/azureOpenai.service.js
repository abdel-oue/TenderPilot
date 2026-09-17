/**
 * Azure OpenAI Service
 * The ONLY place an HTTP call leaves this codebase for a model provider.
 *
 * Two endpoint shapes are in play and they are not interchangeable:
 *   - the reasoning tier is served on Azure's OpenAI-compatible /openai/v1 path,
 *     so the plain OpenAI client works against it unchanged;
 *   - the volume tier is a classic Azure resource, which needs an api-version and
 *     addresses the model by DEPLOYMENT name rather than model name.
 * One class, configured twice, rather than two near-identical classes.
 */
import OpenAI, { AzureOpenAI } from 'openai';
import { logger } from '../lib/logger.js';

/**
 * Providers report usage under two different key sets depending on the API
 * generation. Normalising here means nothing downstream has to know which.
 * @param {object} usage
 * @returns {{ promptTokens: number, completionTokens: number, totalTokens: number }}
 */
export function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const promptTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0;
  const completionTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0;
  const totalTokens = Number(usage.total_tokens ?? 0) || promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

export default class AzureOpenAiService {
  /**
   * @param {object} config
   * @param {'reasoning'|'volume'} config.tier which cost tier this instance serves
   * @param {string} config.apiKey
   * @param {string} config.model model id, or the deployment name on classic Azure
   * @param {string} [config.baseURL] OpenAI-compatible base URL (reasoning tier)
   * @param {string} [config.endpoint] classic Azure resource endpoint (volume tier)
   * @param {string} [config.apiVersion] required with `endpoint`
   * @param {number} [config.maxTokens]
   * @param {number} [config.timeoutMs]
   * @param {boolean} [config.supportsTemperature] gpt-5.5 rejects any value but its
   *   default and answers 400, so the sampling knob is a property of the model, not
   *   something every caller should have to remember
   */
  constructor({
    tier,
    apiKey,
    model,
    baseURL,
    endpoint,
    apiVersion,
    maxTokens,
    timeoutMs = 120_000,
    supportsTemperature = true,
  }) {
    if (!apiKey) throw new Error(`AzureOpenAiService[${tier}]: apiKey is required`);
    if (!model) throw new Error(`AzureOpenAiService[${tier}]: model is required`);
    if (!baseURL && !endpoint) {
      throw new Error(`AzureOpenAiService[${tier}]: one of baseURL or endpoint is required`);
    }

    this.tier = tier;
    this.model = model;
    this.maxTokens = maxTokens;
    this.supportsTemperature = supportsTemperature;

    // maxRetries covers transient 429/5xx from the shared quota. The timeout is
    // what stops a hung provider call from pinning a BullMQ worker forever.
    this.client = endpoint
      ? new AzureOpenAI({
          endpoint,
          apiKey,
          apiVersion,
          deployment: model,
          timeout: timeoutMs,
          maxRetries: 2,
        })
      : new OpenAI({ baseURL, apiKey, timeout: timeoutMs, maxRetries: 2 });
  }

  /**
   * One chat completion constrained to a JSON object.
   *
   * `json_object` rather than `json_schema`: it is the mode both endpoints
   * implement, and a zod schema is the real contract either way.
   *
   * @param {{ system: string, user: string, temperature?: number, maxTokens?: number, messages?: object[] }} options
   * @returns {Promise<{ content: string, usage: object, latencyMs: number, model: string }>}
   */
  async chatJson({ system, user, temperature = 0, maxTokens, messages }) {
    const payload = messages ?? [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    const startedAt = Date.now();
    const response = await this.client.chat.completions.create({
      model: this.model,
      ...(this.supportsTemperature ? { temperature } : {}),
      max_completion_tokens: maxTokens ?? this.maxTokens,
      response_format: { type: 'json_object' },
      messages: payload,
    });
    const latencyMs = Date.now() - startedAt;

    return {
      content: response.choices[0]?.message?.content ?? '',
      usage: normalizeUsage(response.usage),
      latencyMs,
      model: this.model,
    };
  }

  /**
   * @param {string[]} inputs
   * @param {string} model embedding model id
   * @param {number} [dimensions]
   * @returns {Promise<{ vectors: number[][], usage: object, latencyMs: number, model: string }>}
   */
  async embed(inputs, model, dimensions) {
    const startedAt = Date.now();
    const response = await this.client.embeddings.create({
      model,
      input: inputs,
      ...(dimensions ? { dimensions } : {}),
    });
    const latencyMs = Date.now() - startedAt;

    logger.debug({ count: inputs.length, model, latencyMs }, 'embeddings: done');

    return {
      vectors: response.data.map((d) => d.embedding),
      usage: normalizeUsage(response.usage),
      latencyMs,
      model,
    };
  }
}
