/**
 * Tavily Service
 * The only outbound call to the open web. Used for the cahier des charges bonus
 * "comparer avec les derniers marches attribues similaires", and for background
 * on a buyer or a certification the dossier demands.
 *
 * Three rules, because this runs inside a live demo:
 *
 *   1. ABSENT KEY MEANS ABSENT TOOL. `isEnabled` is false without TAVILY_API_KEY
 *      and the tool is never registered, so the model cannot call something that
 *      would throw. No key is a configuration, not a failure.
 *   2. NEVER FAIL THE RUN. A timeout, a 429 or a DNS failure returns an empty
 *      result set, not an exception. External evidence is a bonus; a dossier
 *      analysis that dies because a search engine blinked is not.
 *   3. CACHED BY QUERY. The same question inside one process is asked once. Demo
 *      reruns are free and the free-tier quota is not spent on repetition.
 *
 * No SDK: the API is one POST and Node 22 ships fetch and AbortSignal.timeout.
 */
import { createHash } from 'node:crypto';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const ENDPOINT = 'https://api.tavily.com/search';
const TIMEOUT_MS = 8_000;
const MAX_CACHE_ENTRIES = 200;

export default class TavilyService {
  /**
   * @param {object} [options]
   * @param {string} [options.apiKey] defaults to TAVILY_API_KEY
   * @param {typeof fetch} [options.fetchImpl] injectable for tests
   * @param {number} [options.timeoutMs]
   */
  constructor({ apiKey = env.TAVILY_API_KEY, fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.cache = new Map();
  }

  /** @returns {boolean} whether the tool should be offered to the agent at all */
  get isEnabled() {
    return Boolean(this.apiKey);
  }

  /**
   * `fullContent` is part of the key, not just part of the request: without it a
   * call asking for whole pages is served the snippet-only response cached from
   * an earlier call, and the agent silently reasons over truncated evidence while
   * believing it has the full text.
   *
   * @param {string} query
   * @param {number} maxResults
   * @param {boolean} fullContent
   * @returns {string} cache key
   */
  static cacheKey(query, maxResults, fullContent = false) {
    return createHash('sha256')
      .update(query + '|' + maxResults + '|' + (fullContent ? 'raw' : 'snippet'))
      .digest('hex');
  }

  /**
   * Searches the web. Always resolves.
   *
   * `fullContent` asks Tavily for the pages' raw text instead of snippets. It is
   * a flag on this request rather than a separate fetch_url tool: Tavily already
   * fetches the page, so reading it back through our own HTTP client would buy
   * nothing and cost an SSRF allowlist, a size ceiling and an HTML sanitiser.
   *
   * @param {string} query
   * @param {{ maxResults?: number, depth?: 'basic'|'advanced', fullContent?: boolean }} [options]
   * @returns {Promise<{ results: { title: string, url: string, content: string, score: number }[], answer: string|null, degraded: boolean }>}
   */
  async search(query, { maxResults = 5, depth = 'basic', fullContent = false } = {}) {
    if (!this.isEnabled) {
      return { results: [], answer: null, degraded: true };
    }

    const key = TavilyService.cacheKey(query, maxResults, fullContent);
    if (this.cache.has(key)) return this.cache.get(key);

    let payload;
    try {
      const response = await this.fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + this.apiKey,
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: depth,
          include_answer: true,
          include_raw_content: fullContent,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        logger.warn({ status: response.status, query }, 'tavily: non-ok response, degrading');
        return { results: [], answer: null, degraded: true };
      }
      payload = await response.json();
    } catch (error) {
      // Timeout, DNS, offline jury wifi. The run continues without web evidence.
      logger.warn({ err: error.message, query }, 'tavily: unreachable, degrading');
      return { results: [], answer: null, degraded: true };
    }

    const result = {
      results: (payload.results ?? []).map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        // raw_content when the caller asked for whole pages, capped: a 200 KB
        // page pushed into a prompt is a context overflow, not evidence.
        content: (fullContent ? (r.raw_content ?? r.content) : r.content ?? '').slice(0, 6000),
        score: typeof r.score === 'number' ? r.score : 0,
      })),
      answer: payload.answer ?? null,
      degraded: false,
    };

    this.remember(key, result);
    logger.info({ query, results: result.results.length }, 'tavily: search');
    return result;
  }

  /**
   * Bounded LRU-ish cache: a long demo session must not grow unbounded.
   * @param {string} key
   * @param {object} value
   * @returns {void}
   */
  remember(key, value) {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }
}
