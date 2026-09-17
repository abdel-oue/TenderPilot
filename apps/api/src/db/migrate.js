// Applies pending migrations. Run on api startup and by `npm run db:migrate`.
//
// TODO: read src/db/migrations/ (resolved from import.meta.dirname, not cwd)
// TODO: apply with drizzle-orm's migrator, inside a transaction
// TODO: log which migrations ran; exit non-zero on failure so the container restarts
