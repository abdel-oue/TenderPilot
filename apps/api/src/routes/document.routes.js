/**
 * Document routes. Dispatch only.
 */
import DocumentController from '../controllers/document.controller.js';

/**
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export default async function documentRoutes(app) {
  const controller = new DocumentController();

  app.get('/documents/:id', (request, reply) => controller.get(request, reply));
  app.get('/documents/:id/pages', (request, reply) => controller.pages(request, reply));
  app.get('/documents/:id/file', (request, reply) => controller.file(request, reply));
}
