/**
 * Document Controller
 * Validate, dispatch, map to a status code.
 */
import { appError } from '../lib/errors.js';
import { MAX_UPLOAD_BYTES } from '../lib/uploads.js';
import DocumentService from '../services/document.service.js';
import { parseDocumentIdParam, parseUpload } from '../validators/document.validator.js';
import { parseTenderIdParam } from '../validators/tender.validator.js';

export default class DocumentController {
  /** @param {DocumentService} [documentService] injectable for tests */
  constructor(documentService = new DocumentService()) {
    this.documents = documentService;
  }

  /**
   * Pulls the single file and its `kind` field off a multipart request.
   *
   * Shared by both upload routes, which differ only in which kinds are legal and
   * whether there is a tender to attach to.
   *
   * @param {object} request
   * @param {'tender'|'company'} target
   * @returns {Promise<{ buffer: Buffer, kind: string, originalName: string }>}
   */
  async readUpload(request, target) {
    const part = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!part) throw appError('Aucun fichier recu.', 'UPLOAD_MISSING', 400);

    const buffer = await part.toBuffer();
    // @fastify/multipart truncates rather than throwing when the limit is hit, so
    // the flag has to be read explicitly - otherwise a too-big PDF is silently
    // stored half-written and fails much later, during OCR.
    if (part.file.truncated) {
      throw appError('Fichier trop volumineux.', 'UPLOAD_TOO_LARGE', 413);
    }

    const { kind, originalName } = parseUpload(
      { kind: part.fields?.kind?.value, originalName: part.filename },
      target,
    );
    return { buffer, kind, originalName };
  }

  /**
   * POST /tenders/:id/documents - EX-01, the deposit.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async uploadToTender(request, reply) {
    const { id } = parseTenderIdParam(request.params);
    const upload = await this.readUpload(request, 'tender');
    const document = await this.documents.upload({
      ...upload,
      ownerId: request.user.id,
      tenderId: id,
    });
    return reply.code(201).send(document);
  }

  /**
   * POST /company/documents
   * The company's own corpus: attestations, past memoires, profil. Indexed as
   * soon as it lands, which is what makes it citable by the Writer.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async uploadToCompany(request, reply) {
    const upload = await this.readUpload(request, 'company');
    const document = await this.documents.upload({
      ...upload,
      ownerId: request.user.id,
      tenderId: null,
    });
    return reply.code(201).send(document);
  }

  /**
   * GET /company/documents
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async listCompany(request, reply) {
    return reply.send({
      documents: await this.documents.listCompanyDocuments(request.user.id),
    });
  }

  /**
   * GET /documents/:id
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async get(request, reply) {
    const { id } = parseDocumentIdParam(request.params);
    return reply.send(await this.documents.getById(id, request.user.id));
  }

  /**
   * GET /documents/:id/pages
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async pages(request, reply) {
    const { id } = parseDocumentIdParam(request.params);
    return reply.send(await this.documents.getPages(id, request.user.id));
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
    const { stream, filename } = await this.documents.getFileStream(id, request.user.id);
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', 'inline; filename="' + filename + '"')
      .send(stream);
  }
}
