/**
 * Document routes. Dispatch only.
 *
 * requireAuth on every one of them: a document belongs to exactly one company,
 * and the session is the only thing that says which.
 */
import { requireAuth } from '../lib/auth.js';
import DocumentController from '../controllers/document.controller.js';

/**
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export default async function documentRoutes(app) {
  const controller = new DocumentController();

  app.addHook('preHandler', requireAuth);

  app.post('/tenders/:id/documents', (request, reply) =>
    controller.uploadToTender(request, reply),
  );
  app.post('/company/documents', (request, reply) => controller.uploadToCompany(request, reply));
  app.get('/company/documents', (request, reply) => controller.listCompany(request, reply));

  app.get('/documents/:id', (request, reply) => controller.get(request, reply));
  app.get('/documents/:id/pages', (request, reply) => controller.pages(request, reply));
  app.get('/documents/:id/file', (request, reply) => controller.file(request, reply));
}
