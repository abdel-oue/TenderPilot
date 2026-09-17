-- TenderPilot schema. Runs once, by the postgres container's initdb
-- (mount: ./docker/init.sql -> /docker-entrypoint-initdb.d/init.sql).
-- Drop the named volume to re-run it. Later changes go in a drizzle migration.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid, crypt/gen_salt

-- ---------------------------------------------------------------- auth
-- Login/logout only: no roles, no signup flow, no password reset (multi-user
-- auth is out of scope per the cahier des charges). password_hash is bcrypt.
-- The session is a JWT signed with JWT_SECRET, held in an httpOnly cookie:
-- logout clears the cookie. No sessions table.
-- ponytail: no server-side revocation, so keep the expiry short (a few hours);
-- add a sessions table if a token ever needs killing before it expires.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Demo account: demo@tenderpilot.local / demo1234. Local fixture only.
INSERT INTO users (email, password_hash, display_name)
VALUES ('demo@tenderpilot.local', crypt('demo1234', gen_salt('bf', 10)), 'Demo')
ON CONFLICT (email) DO NOTHING;

