-- Runs ONCE, by the postgres container's initdb, on an empty volume
-- (mount: ./docker/init.sql -> /docker-entrypoint-initdb.d/init.sql).
--
-- Extensions ONLY. Every table is owned by a drizzle migration — if a table were
-- created here too, initdb would win the race on a fresh volume and the first
-- migration would die on `relation already exists`.
--
-- The demo account lives in the seed, not here: it needs the same scrypt hash
-- format as lib/password.js, which pgcrypto's crypt() cannot produce.

CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector, for document_chunks.embedding
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
