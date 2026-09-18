/**
 * Tender Controller
 * Validate, dispatch to the service, map to a status code. Nothing else.
 *
 * `request.user.id` is the owner on every call, and it comes from the session
 * cookie - never from the body or a query string. A client cannot ask for
 * someone else's dossiers because there is no field in which to ask.
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
    return reply.send({ tenders: await this.tenders.list(request.user.id) });
  }

  /**
   * GET /tenders/:id
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async get(request, reply) {
    const { id } = parseTenderIdParam(request.params);
    return reply.send(await this.tenders.getById(id, request.user.id));
  }

  /**
   * GET /tenders/:id/requirements - EX-02, the compliance matrix.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async requirements(request, reply) {
    const { id } = parseTenderIdParam(request.params);
    return reply.send(await this.tenders.getRequirements(id, request.user.id));
  }

  /**
   * POST /tenders
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async create(request, reply) {
    const body = parseCreateTenderBody(request.body);
    return reply.code(201).send(await this.tenders.create(body, request.user.id));
  }
}
