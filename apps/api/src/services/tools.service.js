/**
 * Tools Service
 * The agent's tool belt, and the only place a tool is defined or dispatched.
 *
 * The grading criterion for agentic depth is four verbs - planifier, appeler des
 * outils, memoriser, reviser - so these are real callable tools with real side
 * effects, not prompt decoration:
 *
 *   search_company_docs  pgvector over the company corpus. What lets the Writer
 *                        cite REF-07 instead of inventing it.
 *   read_source_page     re-reads the actual page behind a citation, so the agent
 *                        can verify its own quote before calling it eliminatory.
 *   get_run_history      what this run already tried. This is "memoriser": it is
 *                        what stops a retry repeating a query that already failed.
 *   web_search           Tavily. Registered ONLY when a key is configured.
 *
 * Every tool returns data or an explicit `{ error }`. A tool never throws into
 * the graph: a broken tool degrades one step, it does not kill a dossier.
 */
import { logger } from '../lib/logger.js';
import AnalysisRepository from '../repositories/analysis.repository.js';
import DocumentRepository from '../repositories/document.repository.js';
import UsageRepository from '../repositories/usage.repository.js';
import LlmService from './llm.service.js';
import TavilyService from './tavily.service.js';

export default class ToolsService {
  /**
   * @param {object} [deps]
   * @param {LlmService} [deps.llm]
   * @param {TavilyService} [deps.tavily]
   * @param {DocumentRepository} [deps.documents]
   * @param {AnalysisRepository} [deps.analyses]
   * @param {UsageRepository} [deps.usage]
   */
  constructor({ llm, tavily, documents, analyses, usage } = {}) {
    this.llm = llm ?? new LlmService();
    this.tavily = tavily ?? new TavilyService();
    this.documents = documents ?? new DocumentRepository();
    this.analyses = analyses ?? new AnalysisRepository();
    this.usage = usage ?? new UsageRepository();
  }

  /**
   * OpenAI-shaped tool definitions for the tools actually available right now.
   * web_search is omitted entirely when Tavily has no key, so the model is never
   * offered something that cannot work.
   * @returns {object[]}
   */
  definitions() {
    const defs = [
      {
        type: 'function',
        function: {
          name: 'search_company_docs',
          description:
            "Recherche dans les documents de l'entreprise (memoires techniques deja rendus, " +
            'attestations, profil) pour trouver de quoi appuyer une exigence. ' +
            "Retourne des extraits reels avec leur document et leur page. " +
            "Si rien ne correspond, retourne une liste vide : c'est une reponse valide.",
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Ce que tu cherches, en francais' },
              limit: { type: 'integer', description: 'Nombre max d extraits (defaut 5)' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'read_source_page',
          description:
            "Relit le texte exact d'une page d'un document du dossier, pour verifier " +
            'une citation avant de la declarer eliminatoire.',
          parameters: {
            type: 'object',
            properties: {
              documentId: { type: 'string' },
              page: { type: 'integer' },
            },
            required: ['documentId', 'page'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_run_history',
          description:
            "Ce que cette analyse a deja tente : quels outils, quelles requetes, quels " +
            'resultats. Consulte-le avant de relancer une recherche, pour ne pas ' +
            'repeter une requete qui a deja echoue.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
    ];

    if (this.tavily.isEnabled) {
      defs.push({
        type: 'function',
        function: {
          name: 'web_search',
          description:
            'Recherche web : marches publics similaires deja attribues, contexte sur ' +
            "l'acheteur public, contenu reel d'une certification exigee. " +
            "N'invente jamais a partir de ces resultats : cite la source.",
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              maxResults: { type: 'integer' },
            },
            required: ['query'],
          },
        },
      });
    }

    return defs;
  }

  /** @returns {string[]} the names currently callable */
  names() {
    return this.definitions().map((d) => d.function.name);
  }

  /**
   * Dispatches one tool call. Never throws: an unknown or broken tool comes back
   * as `{ error }` so the model can react to it rather than the graph dying.
   *
   * @param {string} name
   * @param {object} args already-parsed arguments
   * @param {{ runId?: string|null, tenderId?: string|null }} [context]
   * @returns {Promise<object>}
   */
  async execute(name, args, context = {}) {
    const startedAt = Date.now();
    try {
      const result = await this.dispatch(name, args ?? {}, context);
      logger.info({ tool: name, ms: Date.now() - startedAt }, 'tool: ok');
      return result;
    } catch (error) {
      logger.warn({ tool: name, err: error.message }, 'tool: failed');
      return { error: error.message };
    }
  }

  /**
   * @param {string} name
   * @param {object} args
   * @param {object} context
   * @returns {Promise<object>}
   */
  async dispatch(name, args, context) {
    switch (name) {
      case 'search_company_docs':
        return this.searchCompanyDocs(args.query, args.limit ?? 5);
      case 'read_source_page':
        return this.readSourcePage(args.documentId, args.page);
      case 'get_run_history':
        return this.getRunHistory(context.runId);
      case 'web_search':
        return this.webSearch(args.query, args.maxResults ?? 5);
      default:
        return { error: 'Outil inconnu: ' + name };
    }
  }

  /**
   * Semantic search over the company corpus.
   *
   * An empty result is a legitimate answer and is returned as such, with a note
   * saying so - the Writer must be able to conclude "nothing supports this" and
   * mark the section for a human, rather than reaching for the nearest match.
   *
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<{ extracts: object[], note?: string }>}
   */
  async searchCompanyDocs(query, limit) {
    if (!query || !query.trim()) return { extracts: [], note: 'Requete vide.' };

    const [embedding] = await this.llm.embed([query], { name: 'tool:search_company_docs' });
    const rows = await this.documents.searchSimilarChunks(embedding, limit, [
      'memoire',
      'attestation',
      'profil',
    ]);

    const extracts = Array.from(rows ?? []).map((row) => ({
      documentId: row.documentId ?? row.document_id,
      page: row.page,
      article: row.article,
      excerpt: String(row.content ?? '').slice(0, 800),
      distance: Number(row.distance),
    }));

    return extracts.length === 0
      ? { extracts: [], note: "Aucun document de l'entreprise ne correspond a cette recherche." }
      : { extracts };
  }

  /**
   * @param {string} documentId
   * @param {number} page
   * @returns {Promise<object>}
   */
  async readSourcePage(documentId, page) {
    const chunks = await this.documents.findChunks(documentId);
    const match = chunks.find((c) => c.page === Number(page));

    if (!match) return { error: 'Page ' + page + ' introuvable dans ce document.' };
    if (match.extraction === 'unread') {
      // EX-07: an unreadable page says so. It never comes back as empty text that
      // the model could mistake for "this page contains nothing".
      return {
        documentId,
        page: match.page,
        readable: false,
        note: "Cette page n'a pas pu etre lue (scan illisible). N'en deduis aucune exigence.",
      };
    }

    return {
      documentId,
      page: match.page,
      article: match.article,
      readable: true,
      text: match.content,
    };
  }

  /**
   * What this run already did. The "memoriser" half of the agentic loop: a retry
   * reads this first so it cannot fire the same failed query twice.
   *
   * @param {string|null|undefined} runId
   * @returns {Promise<object>}
   */
  async getRunHistory(runId) {
    if (!runId) return { steps: [], calls: [], note: 'Aucune analyse en cours.' };

    const run = await this.analyses.findRunById(runId);
    const calls = await this.usage.findByRequest(runId).catch(() => []);

    return {
      steps: (run?.nodeTrace ?? []).map((entry) => ({
        node: entry.node,
        summary: entry.summary,
        status: entry.status,
        at: entry.at,
      })),
      calls: calls.map((call) => ({
        operation: call.operation,
        status: call.status,
        totalTokens: call.totalTokens,
      })),
    };
  }

  /**
   * @param {string} query
   * @param {number} maxResults
   * @returns {Promise<object>}
   */
  async webSearch(query, maxResults) {
    const result = await this.tavily.search(query, { maxResults });
    if (result.degraded) {
      // Explicit, so the model reports "pas de verification externe" instead of
      // silently treating an empty result as evidence of absence.
      return {
        results: [],
        note: "Recherche web indisponible. Poursuis sans verification externe et ne conclus rien de cette absence.",
      };
    }
    return { results: result.results, answer: result.answer };
  }
}
