/**
 * Tender routes. Dispatch only.
 */
import { requireAuth } from '../lib/auth.js';
import TenderController from '../controllers/tender.controller.js';

/**
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export default async function tenderRoutes(app) {
  const controller = new TenderController();

  // One company per user: there is no unscoped view of a dossier, so there is no
  // route here that can be reached without a session.
  app.addHook('preHandler', requireAuth);

  app.get('/tenders', (request, reply) => controller.list(request, reply));
  app.get('/tenders/:id', (request, reply) => controller.get(request, reply));
  app.get('/tenders/:id/requirements', (request, reply) => controller.requirements(request, reply));
  app.post('/tenders', (request, reply) => controller.create(request, reply));
}
