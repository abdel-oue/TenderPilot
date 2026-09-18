/**
 * Company Controller
 * Validate, dispatch, map to a status code.
 */
import CompanyService from '../services/company.service.js';

export default class CompanyController {
  /** @param {CompanyService} [companyService] injectable for tests */
  constructor(companyService = new CompanyService()) {
    this.company = companyService;
  }

  /**
   * GET /company
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async get(request, reply) {
    return reply.send(await this.company.get(request.user.id));
  }

  /**
   * POST /company/profile
   * The body is validated inside the service, against the same zod schema the
   * seed uses - one definition of what a company profile is.
   * @param {object} request
   * @param {object} reply
   * @returns {Promise<object>}
   */
  async importProfile(request, reply) {
    const summary = await this.company.importProfile(request.user.id, request.body);
    return reply.code(201).send(summary);
  }
}
