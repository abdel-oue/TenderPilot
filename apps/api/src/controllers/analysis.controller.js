/**
 * Analysis Controller
 * Orchestrates the analysis endpoints: validate, dispatch to the service, map to
 * a status code. No SQL, no business logic, no prompt text.
 */
import AnalysisService from '../services/analysis.service.js';
import ExportService from '../services/export.service.js';
import {
  parseRunIdParam,
  parseSectionEditBody,
  parseTenderIdParam,
} from '../validators/analysis.validator.js';

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
