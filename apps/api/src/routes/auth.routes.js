import { parseLoginBody, parseSignupBody } from '../validators/auth.validator.js';
import AuthService from '../services/auth.service.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../lib/session.js';

/**
 * Auth routes. Validate, dispatch, set the cookie. Nothing else.
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export default async function authRoutes(app) {
  const authService = new AuthService();

  app.post('/signup', async (request, reply) => {
    const { user, token } = await authService.signup(parseSignupBody(request.body));
    setSessionCookie(reply, token);
    return reply.code(201).send({ user });
  });

  app.post('/login', async (request, reply) => {
    const { user, token } = await authService.login(parseLoginBody(request.body));
    setSessionCookie(reply, token);
    return reply.send({ user });
  });

  app.post('/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ user: await authService.getCurrentUser(request.user.id) });
  });
}
