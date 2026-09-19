/**
 * Analysis Controller
 * Orchestrates the analysis endpoints: validate, dispatch to the service, map to
 * a status code. No SQL, no business logic, no prompt text.
 */
import AnalysisService from '../services/analysis.service.js';
import ExportService from '../services/export.service.js';
import {
  parseHumanAnswerBody,
  parseRunIdParam,
  parseSectionEditBody,
  parseTenderIdParam,
} from '../validators/analysis.validator.js';
import { subscribeRunEvents } from '../lib/runEvents.js';

// SSE frames end on a blank line. Named because a lost newline here is a stream
// that connects, stays open and never delivers anything.
const SSE_END = '\n\n';

export default class AnalysisController {
  /**
   * @param {AnalysisService} [analysisService] injectable for tests
   * @param {ExportService} [exportService]
   */
  constructor(analysisService = new AnalysisService(), exportService = new ExportService()) {
    this.analyses = analysisService;
    this.exports = exportService;
  }

  /**
   * POST /tenders/:id/analyze - EX-01, the trigger.
   * 202: accepted and queued. The graph is a minute of OCR and model calls, so
   * it never runs inside the request.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async start(request, reply) {
    const { id } = parseTenderIdParam(request.params);
    const run = await this.analyses.start(id, request.user.id);
    return reply.code(202).send(run);
  }

  /**
   * GET /tenders/:id/analysis - what the UI polls.
   * Carries the node trace whatever the status, so a running analysis shows its
   * reasoning live and a failed one shows how far it got.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async get(request, reply) {
    const { id } = parseTenderIdParam(request.params);
    return reply.send(await this.analyses.getByTender(id, request.user.id));
  }

  /**
   * GET /tenders/:id/analysis/stream - the same data as get(), sooner.
   *
   * The poll stays: this is a latency improvement, not a second source of truth.
   * A closed stream, a dead Redis or a proxy that hates SSE all degrade to the
   * screen refreshing once a second, which is what it did before.
   *
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<void>}
   */
  async stream(request, reply) {
    const { id } = parseTenderIdParam(request.params);
    // Ownership is checked the same way every other read is, BEFORE a channel is
    // opened: a runId is not a capability.
    const envelope = await this.analyses.getByTender(id, request.user.id);

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // nginx buffers proxied responses by default, which holds every event
      // until the response ends - i.e. forever, for a stream.
      'x-accel-buffering': 'no',
    });

    /** @param {object} event @returns {void} */
    const send = (event) => {
      if (!reply.raw.writableEnded) reply.raw.write('data: ' + JSON.stringify(event) + SSE_END);
    };

    // The current status first, so a browser that connects late is not stuck
    // rendering "en attente" for a run that finished while it was reconnecting.
    send({ type: 'status', status: envelope.status });
    if (envelope.pendingQuestion) send({ type: 'ask', question: envelope.pendingQuestion });

    const unsubscribe = await subscribeRunEvents(envelope.runId, send);
    // A comment line keeps proxies and load balancers from reaping an idle
    // connection during a long node.
    const heartbeat = setInterval(() => {
      if (!reply.raw.writableEnded) reply.raw.write(': keep-alive' + SSE_END);
    }, 15_000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      void unsubscribe();
    });
  }

  /**
   * POST /analyses/:runId/answer - the human replies to ask_human and the graph
   * resumes from its checkpoint.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async answer(request, reply) {
    const { runId } = parseRunIdParam(request.params);
    const body = parseHumanAnswerBody(request.body);
    return reply.code(202).send(await this.analyses.answer(runId, body, request.user.id));
  }

  /**
   * PATCH /analyses/:runId/sections - EX-06.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async saveSection(request, reply) {
    const { runId } = parseRunIdParam(request.params);
    const body = parseSectionEditBody(request.body);
    return reply.send(await this.analyses.saveSectionEdit(runId, body, request.user.id));
  }

  /**
   * GET /analyses/:runId/export.docx - EX-05.
   * Sent as an attachment so the browser downloads it rather than trying to
   * render a binary.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async exportDocx(request, reply) {
    const { runId } = parseRunIdParam(request.params);
    const { buffer, filename } = await this.exports.exportDocx(runId, request.user.id);
    return reply
      .header(
        'content-type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      .header('content-disposition', 'attachment; filename="' + filename + '"')
      .send(buffer);
  }
}
