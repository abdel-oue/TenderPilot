// Fastify bootstrap ONLY. No routes defined inline, no business logic, no DB.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { closeDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.js';

const app = Fastify({ loggerInstance: logger });

// credentials: the session cookie is cross-origin (web :3100 -> api :3000).
await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

await app.register(authRoutes, { prefix: '/auth' });

app.get('/health', async () => ({ status: 'ok' }));

app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) return reply.code(error.status).send(error.toBody());
  request.log.error({ error }, 'unhandled error');
  return reply.code(500).send({ error: 'Une erreur interne est survenue.', code: 'INTERNAL_ERROR' });
});

app.setNotFoundHandler((_request, reply) =>
  reply.code(404).send({ error: 'Ressource introuvable.', code: 'NOT_FOUND' }),
);

await runMigrations();
await app.listen({ port: env.PORT, host: '0.0.0.0' });

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  });
}
