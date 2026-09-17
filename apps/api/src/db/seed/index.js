// Seed entry point. Idempotent. Non-destructive. Run it five times, same rows.
//
// The corpus sits BESIDE this file, in seed/data/ - gitignored, dropped in locally.
// Resolve it relative to this module (import.meta.dirname, Node 22+), never from cwd:
// the seed runs from the repo root in dev and from /app in the container.
//
// TODO: read data/profil-entreprise.json (validate with companySchema before
//       inserting - the seed is an input boundary)
// TODO: read data/references.csv and data/equipe.csv
// TODO: upsert on the stable business keys: onConflictDoNothing / onConflictDoUpdate
//       keyed on REF-01.., CV-01..
// TODO: register the 10 dossiers under data/avis/ as tenders + documents
// TODO: log what was CREATED vs what was SKIPPED. Silence is not a success report.
//
// NEVER: TRUNCATE, DROP, or an unfiltered DELETE. Not here, not ever.
// NEVER: faker, random ids, Date.now() in seed data. Same rows on every machine.
// Destructive reset is a separate command: db:reset, guarded, never called from here.
