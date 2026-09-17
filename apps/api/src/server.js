// Fastify bootstrap ONLY. No routes defined inline, no business logic, no DB.
// ESM: this file is `import`, never `require`.
//
// TODO: create the fastify instance with the pino logger
// TODO: CORS - allow WEB_ORIGIN (http://localhost:3100) on every response,
//       handle preflight
// TODO: register routes/ modules under their prefixes
// TODO: run pending migrations on startup
// TODO: global error handler -> { error: "Human readable message", code: "SNAKE_CASE_CODE" }
// TODO: listen on PORT (3000), graceful shutdown on SIGTERM
