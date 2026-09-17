/**
 * Tender routes. Dispatch only.
 */
import TenderController from '../controllers/tender.controller.js';

/**
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export default async function tenderRoutes(app) {
  const controller = new TenderController();

  app.get('/tenders', (request, reply) => controller.list(request, reply));
  app.get('/tenders/:id', (request, reply) => controller.get(request, reply));
  app.post('/tenders', (request, reply) => controller.create(request, reply));
}
