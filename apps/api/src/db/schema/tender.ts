// Drizzle table definitions for tenders.
//
// TODO: tenders - id uuid pk, reference text unique (AO-2026-0XX), title, buyer,
//       deadline timestamptz, estimated_value numeric, status text,
//       created_at timestamptz default now() (defaulted in the DB, not in JS)
//
// DB columns snake_case, TS fields camelCase, mapped here. Don't fight it in queries.
