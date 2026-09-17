/**
 * Analysis Service
 * Owns the analysis lifecycle: start a run, execute the graph, read it back.
 * No SQL (repositories) and no HTTP concerns (controller).
 */
import { randomUUID } from 'node:crypto';
import { appError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { runWithContext, setContext } from '../lib/requestContext.js';
import { GRAPH_VERSION, buildGraph } from '../graph/index.js';
import AnalysisRepository from '../repositories/analysis.repository.js';
import TenderRepository from '../repositories/tender.repository.js';

export default class AnalysisService {
  /**
   * @param {object} [deps]
   * @param {AnalysisRepository} [deps.analyses]
   * @param {TenderRepository} [deps.tenders]
   * @param {() => Promise<object>} [deps.graphFactory]
   */
  constructor({ analyses, tenders, graphFactory } = {}) {
    this.analyses = analyses ?? new AnalysisRepository();
    this.tenders = tenders ?? new TenderRepository();
    this.graphFactory = graphFactory ?? buildGraph;
    this.graph = null;
  }

  /** @returns {Promise<object>} the compiled graph, built once per process */
  async getGraph() {
    if (!this.graph) this.graph = await this.graphFactory();
    return this.graph;
  }

  /**
   * Creates a run row and starts the graph. Returns as soon as the run exists:
   * a full analysis is a minute of OCR and model calls, which has no business
   * inside an HTTP request.
   *
   * @param {string} tenderId
   * @returns {Promise<{ runId: string, tenderId: string, status: string }>}
   */
  async start(tenderId) {
    const tender = await this.tenders.findById(tenderId);
    if (!tender) throw appError('Appel d offres introuvable.', 'TENDER_NOT_FOUND', 404);

    const existing = await this.analyses.findLatestRun(tenderId);
    if (existing && existing.status === 'running') {
      // Idempotent by intent: double-clicking "analyser" must not run the graph
      // twice against the same dossier.
      return { runId: existing.id, tenderId, status: 'running', reused: true };
    }

    const run = await this.analyses.createRun(tenderId, GRAPH_VERSION);
    await this.tenders.updateStatus(tenderId, 'analyzing');

    // Deliberately not awaited: the caller gets 202 immediately.
    this.execute(run.id, tenderId).catch((error) =>
      logger.error({ runId: run.id, err: error.message }, 'analysis: run crashed'),
    );

    return { runId: run.id, tenderId, status: 'running', reused: false };
  }

  /**
   * Runs the graph to completion and persists the result.
   * @param {string} runId
   * @param {string} tenderId
   * @returns {Promise<object>} the final graph state
   */
  async execute(runId, tenderId) {
    return runWithContext({ requestId: runId }, async () => {
      setContext({ runId, tenderId });
      await this.analyses.updateRun(runId, { status: 'running' });

      try {
        const graph = await this.getGraph();
        const state = await graph.invoke(
          { tenderId, runId },
          {
            // Keyed on the graph version so a checkpoint from an older graph is
            // never resumed into a newer one.
            configurable: { thread_id: `${tenderId}:${GRAPH_VERSION}` },
            recursionLimit: 25,
          },
        );

        await this.analyses.saveResult(runId, {
          verdict: state.verdict ?? 'no-go',
          confidence: state.confidence ?? 0,
          justification: state.justification ?? 'Analyse incomplete.',
          score: state.score === null || state.score === undefined ? null : String(state.score),
          blockers: state.blockers ?? [],
          matches: state.matches ?? [],
          rubricBreakdown: state.rubricBreakdown ?? [],
          unreadPages: (state.pages ?? [])
            .filter((p) => p.extraction === 'unread')
            .map((p) => ({ documentId: p.documentId, page: p.page })),
        });

        await this.analyses.updateRun(runId, { status: 'done', finishedAt: new Date() });
        await this.tenders.updateStatus(tenderId, 'analyzed');
        logger.info({ runId, verdict: state.verdict }, 'analysis: done');
        return state;
      } catch (error) {
        await this.analyses.updateRun(runId, {
          status: 'failed',
          error: error.message,
          finishedAt: new Date(),
        });
        await this.tenders.updateStatus(tenderId, 'failed');
        throw error;
      }
    });
  }

  /**
   * The current state of a tender's analysis: status, trace, and the result when
   * there is one. This is what the UI polls.
   * @param {string} tenderId
   * @returns {Promise<object>}
   */
  async getByTender(tenderId) {
    const run = await this.analyses.findLatestRun(tenderId);
    if (!run) throw appError('Aucune analyse pour cet appel d offres.', 'ANALYSIS_NOT_FOUND', 404);

    const [result, sections] = await Promise.all([
      this.analyses.findResultByRun(run.id),
      this.analyses.findSections(run.id),
    ]);

    return {
      runId: run.id,
      tenderId: run.tenderId,
      status: run.status,
      graphVersion: run.graphVersion,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      error: run.error,
      nodeTrace: run.nodeTrace ?? [],
      result: result ?? null,
      sections,
    };
  }

  /**
   * EX-06: saves a human correction and marks it as such, so later drafting
   * reads it back and aligns with it.
   * @param {string} runId
   * @param {{ sectionKey: string, title: string, content: string }} input
   * @returns {Promise<object>}
   */
  async saveSectionEdit(runId, input) {
    const run = await this.analyses.findRunById(runId);
    if (!run) throw appError('Analyse introuvable.', 'ANALYSIS_NOT_FOUND', 404);

    return this.analyses.upsertSection({
      runId,
      sectionKey: input.sectionKey,
      title: input.title,
      content: input.content,
      editedByHuman: true,
    });
  }
}
