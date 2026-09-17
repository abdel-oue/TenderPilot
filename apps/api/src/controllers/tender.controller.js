/**
 * Tender Controller
 * Validate, dispatch to the service, map to a status code. Nothing else.
 */
import TenderService from '../services/tender.service.js';
import { parseCreateTenderBody, parseTenderIdParam } from '../validators/tender.validator.js';

export default class TenderController {
  /** @param {TenderService} [tenderService] injectable for tests */
  constructor(tenderService = new TenderService()) {
    this.tenders = tenderService;
  }

  /**
   * GET /tenders
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async list(request, reply) {
    return reply.send({ tenders: await this.tenders.list() });
  }

  /**
   * GET /tenders/:id
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async get(request, reply) {
    const { id } = parseTenderIdParam(request.params);
    return reply.send(await this.tenders.getById(id));
  }

  /**
   * POST /tenders
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async create(request, reply) {
    const body = parseCreateTenderBody(request.body);
    return reply.code(201).send(await this.tenders.create(body));
  }
}
