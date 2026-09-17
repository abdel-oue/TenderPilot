-- TenderPilot schema. Runs once, by the postgres container's initdb
-- (mount: ./docker/init.sql -> /docker-entrypoint-initdb.d/init.sql).
-- Drop the named volume to re-run it. Later changes go in a drizzle migration.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid, crypt/gen_salt

-- ---------------------------------------------------------------- auth
-- Login/logout only: no roles, no signup flow, no password reset (multi-user
-- auth is out of scope per the cahier des charges). password_hash is bcrypt;
-- the session row IS the session, so logout = DELETE.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token      text PRIMARY KEY,                -- random 32B hex, set in the cookie
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

-- Demo account: demo@tenderpilot.local / demo1234. Local fixture only.
INSERT INTO users (email, password_hash, display_name)
VALUES ('demo@tenderpilot.local', crypt('demo1234', gen_salt('bf', 10)), 'Demo')
ON CONFLICT (email) DO NOTHING;

-- ------------------------------------------------------- company profile
-- Seeded from seed/data/profil-entreprise.json + references.csv + equipe.csv.
-- The text pks (REF-01.., CV-01..) are the seed's business keys.

CREATE TABLE company_profile (
  id                int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- single row
  raison_sociale    text NOT NULL,
  forme_juridique   text,
  ice               text,
  rc                text,
  if_fiscal         text,
  cnss              text,
  siege             text,
  creation_year     int,
  effectif          int,
  revenue_ht_mad    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"2025": 61500000, ...}
  certifications    text[] NOT NULL DEFAULT '{}',
  attestations      text[] NOT NULL DEFAULT '{}',
  secteurs_couverts text[] NOT NULL DEFAULT '{}',
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company_references (
  id              text PRIMARY KEY,                -- REF-01..
  client          text NOT NULL,
  secteur         text NOT NULL,
  objet           text NOT NULL,
  montant_ht_mad  numeric(14,2) NOT NULL,
  annee_debut     int NOT NULL,
  duree_mois      int NOT NULL,
  has_attestation boolean NOT NULL DEFAULT false,  -- attestation de bonne exécution
  embedding       vector(1536)                     -- of objet, for reference retrieval
);
CREATE INDEX company_references_secteur_idx ON company_references(secteur);
CREATE INDEX company_references_embedding_idx
  ON company_references USING hnsw (embedding vector_cosine_ops);

CREATE TABLE team_members (
  id                text PRIMARY KEY,              -- CV-01..
  initiales         text NOT NULL,
  poste             text NOT NULL,
  annees_experience int NOT NULL,
  diplome           text,
  certifications    text[] NOT NULL DEFAULT '{}',
  langues           text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX team_members_poste_idx ON team_members(poste);

-- ------------------------------------------------------------- tenders
CREATE TABLE tenders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       text NOT NULL UNIQUE,            -- AO-2026-001..
  title           text,
  buyer           text,
  deadline        timestamptz,
  estimated_value numeric(14,2),
  status          text NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploaded','processing','analyzed','failed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id        uuid REFERENCES tenders(id) ON DELETE CASCADE,  -- null: profil/attestation
  kind             text NOT NULL CHECK (kind IN
                     ('avis','cps','reglement','bpu','planning',
                      'attestation','memoire','profil')),
  file_path        text NOT NULL,
  content_hash     text NOT NULL UNIQUE,           -- parse cache: same bytes, never re-OCR'd
  extraction_path  text CHECK (extraction_path IN ('text_layer','ocr','mixed')),
  page_count       int,
  unreadable_pages int[] NOT NULL DEFAULT '{}',    -- EX-07: reported, never invented over
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_tender_id_idx ON documents(tender_id);

CREATE TABLE document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     text NOT NULL,
  page        int NOT NULL,                        -- provenance carried from extraction
  article     text,
  embedding   vector(1536)
);
CREATE INDEX document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- -------------------------------------------------------- requirements
CREATE TABLE requirements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id      uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  text           text NOT NULL,
  category       text NOT NULL CHECK (category IN
                   ('administratif','technique','financier','equipe','delai','autre')),
  obligation     text NOT NULL CHECK (obligation IN
                   ('obligatoire','optionnel','eliminatoire')),
  document_id    uuid REFERENCES documents(id) ON DELETE SET NULL,
  source_page    int NOT NULL,                     -- EX-03: no requirement without a page
  source_article text,
  confidence     numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  -- Qualifier's verdict per requirement, filled after matching against the profile
  coverage       text CHECK (coverage IN ('covered','partial','missing','unknown')),
  evidence       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{"kind":"reference","id":"REF-03"}]
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX requirements_tender_id_idx ON requirements(tender_id);
CREATE INDEX requirements_blockers_idx ON requirements(tender_id)
  WHERE obligation = 'eliminatoire';

CREATE TABLE rubric_criteria (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id             uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  label                 text NOT NULL,
  max_points            numeric(6,2),
  weight                numeric(6,2),
  elimination_threshold numeric(6,2),              -- null = no threshold on this criterion
  source_page           int,
  document_id           uuid REFERENCES documents(id) ON DELETE SET NULL
);
CREATE INDEX rubric_criteria_tender_id_idx ON rubric_criteria(tender_id);

-- ------------------------------------------------------------ analysis
CREATE TABLE analysis_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id     uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  graph_version text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','needs_human','done','failed')),
  checkpoint    jsonb,                             -- LangGraph checkpointer payload
  error         text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
CREATE INDEX analysis_runs_tender_id_idx ON analysis_runs(tender_id);

CREATE TABLE analysis_results (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             uuid NOT NULL UNIQUE REFERENCES analysis_runs(id) ON DELETE CASCADE,
  verdict            text NOT NULL CHECK (verdict IN ('go','no_go','uncertain')),
  score              numeric(5,2),
  confidence         numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  justification      text NOT NULL,                -- EX-04: natural language, required
  blockers           jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps               jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Mémoire technique, section by section. content_final is the human's correction
-- and it is what the export and the following sections read (EX-06).
CREATE TABLE memo_sections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id     uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  run_id        uuid REFERENCES analysis_runs(id) ON DELETE SET NULL,
  position      int NOT NULL,
  heading       text NOT NULL,
  content_draft text NOT NULL,
  content_final text,                              -- null = never edited by a human
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','validated','corrected','needs_human')),
  citations     jsonb NOT NULL DEFAULT '[]'::jsonb,
  edited_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tender_id, position)
);

-- Compliance agent's checklist: what the dossier still misses before submission.
CREATE TABLE compliance_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id      uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  label          text NOT NULL,
  state          text NOT NULL DEFAULT 'missing'
                 CHECK (state IN ('present','missing','not_applicable')),
  requirement_id uuid REFERENCES requirements(id) ON DELETE SET NULL,
  note           text,
  UNIQUE (tender_id, label)
);
