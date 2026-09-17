/**
 * Document Controller
 * Validate, dispatch, map to a status code.
 */
import DocumentService from '../services/document.service.js';
import { parseDocumentIdParam } from '../validators/document.validator.js';

export default class DocumentController {
  /** @param {DocumentService} [documentService] injectable for tests */
  constructor(documentService = new DocumentService()) {
    this.documents = documentService;
  }

  /**
   * GET /documents/:id
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async get(request, reply) {
    const { id } = parseDocumentIdParam(request.params);
    return reply.send(await this.documents.getById(id));
  }

  /**
   * GET /documents/:id/pages
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async pages(request, reply) {
    const { id } = parseDocumentIdParam(request.params);
    return reply.send(await this.documents.getPages(id));
  }

  /**
   * GET /documents/:id/file - EX-03.
   * Served inline so the browser's PDF viewer opens it and honours #page=N.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async file(request, reply) {
    const { id } = parseDocumentIdParam(request.params);
    const { stream, filename } = await this.documents.getFileStream(id);
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', 'inline; filename="' + filename + '"')
      .send(stream);
  }
}
