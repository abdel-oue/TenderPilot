// npm run db:reset ONLY. Never imported by the seed, by startup, by compose,
// or by any test setup helper.
//
// TODO: refuse when NODE_ENV === 'production'
// TODO: refuse when DATABASE_URL does not point at localhost / the compose host
// TODO: only then drop + recreate the schema and re-run migrations
//
// Guard first, work second.
