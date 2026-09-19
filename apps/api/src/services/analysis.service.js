/**
 * Analysis Service
 * Owns the analysis lifecycle: start a run, execute the graph, read it back.
 * No SQL (repositories) and no HTTP concerns (controller).
 */
import { randomUUID } from 'node:crypto';
import { Command, isInterrupted } from '@langchain/langgraph';
import { appError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { runWithContext, setContext } from '../lib/requestContext.js';
import { publishRunEvent } from '../lib/runEvents.js';
import { GRAPH_VERSION, buildGraph } from '../graph/index.js';
import { analysisJobId, analysisQueue } from '../queue/queues.js';
import AnalysisRepository from '../repositories/analysis.repository.js';
import TenderRepository from '../repositories/tender.repository.js';

export default class AnalysisService {
  /**
   * @param {object} [deps]
   * @param {AnalysisRepository} [deps.analyses]
   * @param {TenderRepository} [deps.tenders]
   * @param {() => Promise<object>} [deps.graphFactory]
   */
  constructor({ analyses, tenders, graphFactory, queue } = {}) {
    this.analyses = analyses ?? new AnalysisRepository();
    this.tenders = tenders ?? new TenderRepository();
    this.graphFactory = graphFactory ?? buildGraph;
    this.queue = queue ?? analysisQueue;
    this.graph = null;
  }

  /** @returns {Promise<object>} the compiled graph, built once per process */
  async getGraph() {
    if (!this.graph) this.graph = await this.graphFactory();
    return this.graph;
  }

  /**
   * Creates a run row and ENQUEUES the graph. Returns as soon as the run exists.
   *
   * The work goes to the worker, not to an un-awaited promise in this process: a
   * full dossier is a minute of OCR and model calls, and leaving it here meant an
   * api restart silently lost every analysis in flight with nothing to retry it.
   *
   * @param {string} tenderId
   * @param {string} ownerId
   * @returns {Promise<{ runId: string, tenderId: string, status: string }>}
   */
  async start(tenderId, ownerId) {
    const tender = await this.tenders.findById(tenderId, ownerId);
    if (!tender) throw appError('Appel d offres introuvable.', 'TENDER_NOT_FOUND', 404);

    const existing = await this.analyses.findLatestRun(tenderId);
    if (existing && ['running', 'queued', 'awaiting_human'].includes(existing.status)) {
      // Idempotent by intent: double-clicking "analyser" must not run the graph
      // twice against the same dossier. A run waiting on a human counts as in
      // flight - starting a second one would abandon a checkpoint mid-question.
      return { runId: existing.id, tenderId, status: existing.status, reused: true };
    }

    const run = await this.analyses.createRun(tenderId, GRAPH_VERSION);
    await this.tenders.updateStatus(tenderId, 'analyzing');

    // ownerId travels with the job: the worker is a separate process with no
    // session, so this is the only way the graph knows whose company to match
    // against.
    await this.queue.add(
      'analyze',
      { runId: run.id, tenderId, ownerId },
      { jobId: analysisJobId(tenderId, GRAPH_VERSION, run.id) },
    );
    logger.info({ runId: run.id, tenderId }, 'analysis: queued');

    return { runId: run.id, tenderId, status: 'queued', reused: false };
  }

  /**
   * Runs the graph to completion and persists the result.
   * @param {string} runId
   * @param {string} tenderId
   * @param {string} ownerId
   * @returns {Promise<object>} the final graph state
   */
  async execute(runId, tenderId, ownerId, resumeWith = null) {
    return runWithContext({ requestId: runId }, async () => {
      setContext({ runId, tenderId });
      await this.setStatus(runId, 'running');

      try {
        const graph = await this.getGraph();
        // A resume hands LangGraph the human's answer instead of a fresh input;
        // the checkpoint under the thread key below supplies everything else.
        const input = resumeWith ? new Command({ resume: resumeWith }) : { tenderId, runId, ownerId };
        const state = await graph.invoke(
          input,
          {
            // Keyed on the RUN, plus the graph version.
            //
            // runId is what makes this correct: every start() mints a new run, so
            // a thread keyed on the tender alone meant a re-analysis resumed the
            // PREVIOUS run's finished checkpoint instead of running. The version
            // is still in the key so a checkpoint from an older graph shape is
            // never resumed into a newer one.
            configurable: { thread_id: `${tenderId}:${runId}:${GRAPH_VERSION}` },
            recursionLimit: 25,
          },
        );

        // The graph did not finish - a node called ask_human and LangGraph parked
        // the task on its checkpoint. Returning normally is deliberate: the
        // BullMQ job completes and frees the worker, which matters because
        // concurrency is 1 and a held job would stall every other dossier. The
        // run is picked back up by answer(), whenever that happens to be.
        if (isInterrupted(state)) {
          await this.setStatus(runId, 'awaiting_human');
          logger.info({ runId, tenderId }, 'analysis: waiting on the human');
          return state;
        }

        await this.analyses.saveResult(runId, {
          verdict: state.verdict ?? 'no-go',
          confidence: state.confidence ?? 0,
          justification: state.justification ?? 'Analyse incomplete.',
          score: state.score === null || state.score === undefined ? null : String(state.score),
          blockers: state.blockers ?? [],
          warnings: state.warnings ?? [],
          matches: state.matches ?? [],
          rubricBreakdown: state.rubricBreakdown ?? [],
          unreadPages: (state.pages ?? [])
            .filter((p) => p.extraction === 'unread')
            .map((p) => ({ documentId: p.documentId, page: p.page })),
        });

        await this.analyses.setPendingQuestion(runId, null);
        await this.setStatus(runId, 'done', { finishedAt: new Date() });
        await this.tenders.updateStatus(tenderId, 'analyzed');
        logger.info({ runId, verdict: state.verdict }, 'analysis: done');
        return state;
      } catch (error) {
        await this.setStatus(runId, 'failed', { error: error.message, finishedAt: new Date() });
        await this.tenders.updateStatus(tenderId, 'failed');
        throw error;
      }
    });
  }

  /**
   * One status change, in the database and on the stream. Every transition goes
   * through here so the live screen and the polled screen can never disagree
   * about what a run is doing.
   *
   * @param {string} runId
   * @param {string} status queued|running|awaiting_human|done|failed
   * @param {object} [patch] extra columns to set in the same write
   * @returns {Promise<void>}
   */
  async setStatus(runId, status, patch = {}) {
    await this.analyses.updateRun(runId, { status, ...patch });
    await publishRunEvent(runId, { type: 'status', status });
  }

  /**
   * Records the human's answer and puts the run back on the queue.
   *
   * The answer is written to the trace BEFORE the job is enqueued, and that
   * order is load-bearing: resuming re-executes the whole node, so ask_human
   * runs again and reads its answer back out of the trace instead of stopping
   * the run a second time.
   *
   * @param {string} runId
   * @param {object} answer humanAnswerSchema, already validated
   * @param {string} ownerId
   * @returns {Promise<{ runId: string, status: string }>}
   */
  async answer(runId, answer, ownerId) {
    const run = await this.findOwnedRun(runId, ownerId);
    if (run.status !== 'awaiting_human' || !run.pendingQuestion) {
      throw appError("Cette analyse n attend pas de reponse.", 'NO_PENDING_QUESTION', 409);
    }
    const pending = run.pendingQuestion;
    if (answer.askId !== pending.askId) {
      // The screen is answering a question this run has moved past.
      throw appError('Cette question n est plus celle en attente.', 'STALE_QUESTION', 409);
    }

    await this.analyses.appendTrace(runId, {
      node: pending.node,
      at: new Date().toISOString(),
      summary: pending.question,
      status: 'human',
      // askKey, not askId: the replayed node recomputes the key from the node and
      // the question text, and cannot know the id we minted for the first pass.
      askKey: pending.askKey,
      choice: answer.choice,
      choiceLabel: pending.options.find((o) => o.value === answer.choice)?.label ?? answer.choice,
      instruction: answer.instruction ?? null,
      verdictOverride: answer.verdictOverride ?? null,
      dismissedBlockers: answer.dismissedBlockers ?? [],
    });
    await this.analyses.setPendingQuestion(runId, null);
    await this.setStatus(runId, 'queued');

    // A new jobId, or BullMQ would dedupe the resume against the job that just
    // completed and nothing would ever pick the run back up.
    await this.queue.add(
      'analyze',
      { runId, tenderId: run.tenderId, ownerId, resume: answer },
      { jobId: analysisJobId(run.tenderId, GRAPH_VERSION, runId + ':' + answer.askId) },
    );
    logger.info({ runId, choice: answer.choice }, 'analysis: resumed by the human');

    return { runId, status: 'queued' };
  }

  /**
   * The current state of a tender's analysis: status, trace, and the result when
   * there is one. This is what the UI polls.
   * @param {string} tenderId
   * @param {string} ownerId
   * @returns {Promise<object>}
   */
  async getByTender(tenderId, ownerId) {
    const tender = await this.tenders.findById(tenderId, ownerId);
    if (!tender) throw appError('Appel d offres introuvable.', 'TENDER_NOT_FOUND', 404);

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
      // Present only while the run is parked. It is what the screen renders the
      // question and its options from after a refresh, when the stream that
      // first announced it is long gone.
      pendingQuestion: run.pendingQuestion ?? null,
      result: result ?? null,
      sections,
    };
  }

  /**
   * EX-06: saves a human correction and marks it as such, so later drafting
   * reads it back and aligns with it.
   * @param {string} runId
   * @param {{ sectionKey: string, title: string, content: string }} input
   * @param {string} ownerId
   * @returns {Promise<object>}
   */
  async saveSectionEdit(runId, input, ownerId) {
    await this.findOwnedRun(runId, ownerId);

    return this.analyses.upsertSection({
      runId,
      sectionKey: input.sectionKey,
      title: input.title,
      content: input.content,
      editedByHuman: true,
    });
  }

  /**
   * A run, but only if the tender behind it belongs to this user. Shared by the
   * section edit (EX-06) and the DOCX export (EX-05) so the ownership check lives
   * in one place rather than being re-derived at each call site.
   * @param {string} runId
   * @param {string} ownerId
   * @returns {Promise<object>} throws ANALYSIS_NOT_FOUND
   */
  async findOwnedRun(runId, ownerId) {
    const run = await this.analyses.findRunById(runId);
    const tender = run ? await this.tenders.findById(run.tenderId, ownerId) : null;
    if (!run || !tender) throw appError('Analyse introuvable.', 'ANALYSIS_NOT_FOUND', 404);
    return run;
  }
}
