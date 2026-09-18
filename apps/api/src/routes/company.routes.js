/**
 * Company routes. Dispatch only.
 *
 * Document upload for the company corpus lives in document.routes.js, with the
 * other document endpoints - it is a document, it just has no tender.
 */
import { requireAuth } from '../lib/session.js';
import CompanyController from '../controllers/company.controller.js';

/**
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export default async function companyRoutes(app) {
  const controller = new CompanyController();

  app.addHook('preHandler', requireAuth);

  app.get('/company', (request, reply) => controller.get(request, reply));
  app.post('/company/profile', (request, reply) => controller.importProfile(request, reply));
}
