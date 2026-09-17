# CLAUDE.md — TenderPilot

Coding rulebook. How code is written in this repo. Nothing about agent design here.

Stack: Next.js 16 App Router + React 19 + TypeScript (web) · Node 20 + Fastify + TypeScript
(api, agents, worker) · LangGraph · PostgreSQL 16 + pgvector via Drizzle · Redis 7 + BullMQ ·
Docker Compose.

---

## Repo layout

```
tenderpilot/
├── docker-compose.yml
├── .env.example
├── .dockerignore                 # root context serves both images
├── docker/
│   └── Dockerfile                # targets: api (worker reuses it), web
├── apps/
│   ├── web/                      # Next.js
│   │   ├── app/                  # routes, page.tsx / layout.tsx
│   │   ├── components/ui/        # generic UI
│   │   ├── hooks/                # use[Name].ts
│   │   ├── lib/
│   │   │   ├── api/              # [entity].ts — fetch wrappers
│   │   │   ├── keys/             # [feature]Keys.ts — react-query key factories
│   │   │   ├── utils/            # [name]Utils.ts
│   │   │   └── types.ts
│   │   ├── tests/
│   │   └── e2e/                  # [flow].spec.ts — Playwright
│   └── api/
│       ├── src/
│       │   ├── server.ts         # fastify bootstrap only
│       │   ├── worker.ts         # BullMQ bootstrap only
│       │   ├── routes/           # [resource].ts
│       │   ├── services/         # [entity]Service.ts
│       │   ├── db/
│       │   │   ├── schema/       # [entity].ts tables, re-exported from index.ts
│       │   │   ├── seed/         # index.ts + data files
│       │   │   ├── migrations/   # generated, committed
│       │   │   └── [entity]Queries.ts
│       │   ├── validators/       # [entity]Validator.ts
│       │   ├── queue/            # queues.ts, jobs/
│       │   ├── graph/            # nodes + graph wiring
│       │   ├── agents/<name>/    # index.ts · prompts.ts · schema.ts
│       │   └── lib/              # llm.ts, pdf.ts, ocr.ts, cache.ts
│       └── tests/
├── packages/shared/
│   └── src/schemas/              # [entity].ts — zod schemas + inferred types, BOTH sides
└── data/                         # fixture corpus, gitignored, read-only
```

Forbidden to touch: `node_modules`, `.next`, `.git`, `.env` and `.env.local`, lockfiles.
`.env.example` is the one exception — it is committed, holds every key with an empty value,
and is updated whenever a new env var is introduced.

---

## Fixture data

`data/` is the input corpus and is **gitignored** — not in the repo, dropped in locally.
10 tender PDFs (`AO-2026-004` and `-009` are pure scans, OCR required), the company
profile as PDF + JSON, `references.csv`, `equipe.csv`, 4 attestations, 2 past technical
memos. Generated from a fixed seed, so it is identical on every machine, and it is what
the seed and the test fixtures draw from. A fresh clone needs it copied in before
`db:seed` will work.

- Read-only. Never rewrite, regenerate, or reformat a file under `data/`.
- Parsed/derived artefacts go to the DB or a gitignored cache dir, never back into `data/`.
- `db/seed/` reads from `data/`, keyed on the stable ids (`REF-01`, `CV-01`, …).

---

## Code organization

- Route files 50–150 lines max. Page files max 200. Component files max 150.
- A route file contains: input validation + service dispatch. Nothing else. It should look
  almost empty.
- All SQL lives in `db/[entity]Queries.ts` — nowhere else.
- All business logic lives in `services/[entity]Service.ts`.
- All input validation lives in `validators/[entity]Validator.ts` (zod).
- All frontend fetch functions live in `lib/api/[entity].ts`.
- All prompt text lives in `agents/<name>/prompts.ts`. No inline prompt strings anywhere else.
- Every LLM call goes through `lib/llm.ts`. One client, one baseURL, one key.
- Any function reused twice gets extracted into `lib/`.
- Shared types/schemas go in `packages/shared`. A type duplicated between web and api is a bug.
- Tests live in the workspace `tests/` folder, mirroring the source path
  (`src/services/scoreService.ts` → `tests/services/scoreService.test.ts`). Never colocated.

---

## Naming

- Files: `camelCase.ts` / `camelCase.tsx` — not PascalCase files
- Components: PascalCase inside the file (`export default function RequirementRow() {}`)
- Hooks: `use[Name].ts` · Query keys: `[feature]Keys.ts` · Services: `[entity]Service.ts`
- Validators: `[entity]Validator.ts` · Queries: `[entity]Queries.ts` · API client: `lib/api/[entity].ts`
- Utils: `lib/utils/[name]Utils.ts` · Routes: `routes/[resource].ts`
- Functions `camelCase`, constants `UPPER_SNAKE_CASE`, DB columns exactly as in Postgres
- Pages `page.tsx`, layouts `layout.tsx`
- Tests `[name].test.ts`

---

## Frontend rules (Next.js)

- Server Components by default. `'use client'` only for: hooks, browser APIs, event handlers, Context.
- Everything in `components/` and `hooks/` is TypeScript. No new `.js` files.
- Prop interfaces declared above each component. `unknown` instead of `any`, then narrow.
- Never fetch with `useEffect` + raw fetch. Custom hook + TanStack Query v5, always.
- Query key factory pattern for every query, in `[feature]Keys.ts`.
- `useMutation` invalidates the relevant keys on success.
- Every data component handles three states: loading (skeleton on pages), error, success.
- Forms: controlled components + `useState`, button `onClick`. Never `<form onSubmit>`.
- Forms show a loading state during the mutation and the error from the mutation result.
- Colors come from CSS variables. No hex, no arbitrary Tailwind values.
- Use the `cn()` helper for conditional className composition.
- Design tokens in the `@theme` block in `globals.css`, not `tailwind.config.js`.
- Framer Motion durations 0.15–0.4s; `AnimatePresence` for exits.
- `cursor-pointer` on every button.
- State management: TanStack Query for server state, `useState`/`useReducer` for UI state.
  No Redux, no Zustand, no Jotai.
- Icons: Lucide React. Theme: `next-themes`.

---

## Backend rules

- No business logic in route files — delegate to `services/`.
- No direct DB calls in route files — delegate to `db/`.
- Validate before dispatching. Always.
- Consistent error shape: `{ error: "Human readable message", code: "SNAKE_CASE_CODE" }`.
- Correct HTTP status codes. Never 200 on a failure path.
- CORS: allow the web origin on every response, handle preflight.
- Every LLM response is parsed against a zod schema. Never `JSON.parse` and hope.
- Logging with Pino. No `console.log` in committed code.
- Async/await everywhere — no floating promises, no missing `await` on DB or LLM calls.
- Long work goes to BullMQ, not into the request handler.

---

## Schema validation (the Pydantic equivalent)

Node has no Pydantic. **Zod is it**, and it is the only one in this repo.

- Every schema lives in `packages/shared/src/schemas/[entity].ts` and is exported with its
  inferred type: `export type Requirement = z.infer<typeof requirementSchema>`.
- Never hand-write a TypeScript interface for something that has a zod schema. Infer it.
- **Every LLM JSON output is parsed with `safeParse`.** Never `JSON.parse` a model response
  straight into a typed variable. On failure: log the zod issues, retry once with the issues
  fed back into the prompt, then fail loud with `SCHEMA_VALIDATION_FAILED`.
- Every HTTP request body is parsed with zod in the validator before it reaches a service.
- No `as SomeType` casts to make a model response type-check. That's lying to the compiler.
- No second validation library. No Joi, no Yup, no class-validator, no ajv.

---

## Database — Drizzle + PostgreSQL

- Table definitions live in `apps/api/src/db/schema/[entity].ts`, re-exported from
  `db/schema/index.ts`. One file per table group.
- All queries are written with the Drizzle query builder inside
  `db/[entity]Queries.ts`. A query written anywhere else is a bug.
- Raw SQL (`sql\`\``) only where Drizzle genuinely can't express it — pgvector similarity,
  a window function. Keep it in the same `Queries.ts` file with a comment saying why.
- Select explicit columns. Never `select()` with no projection on a wide table.
- Migrations are generated, never hand-edited after they've been applied:
  `drizzle-kit generate` → review the SQL → commit it. Migrations are committed to git.
- Never edit an already-applied migration file. Wrong schema → new migration.
- Migrations run on api startup or via an explicit `npm run db:migrate`. Never
  `drizzle-kit push` against anything but a local scratch DB.
- Column naming in the DB is `snake_case`, the TS field is `camelCase`, mapped in the schema
  file. Don't fight it in queries.
- Timestamps: `timestamptz`, defaulted in the DB, not in JS.

---

## Seeding — controlled and non-destructive

The seed exists so a fresh clone has the company profile, the sample tender, and enough data
to demo. It must never be able to nuke work.

- Seed lives in `apps/api/src/db/seed/`, entry point `index.ts`, data files beside it.
- **Idempotent by default.** Every insert is an upsert on a stable business key
  (`onConflictDoNothing` / `onConflictDoUpdate`). Running the seed five times leaves the same
  rows as running it once.
- **The seed never issues `TRUNCATE`, `DROP`, or an unfiltered `DELETE`.** Ever.
- Destructive reset is a separate, explicitly named command (`npm run db:reset`) that is not
  part of `db:seed` and is not called by startup, compose, or any test setup helper by default.
- `db:reset` refuses to run when `NODE_ENV === "production"` or when `DATABASE_URL` does not
  point at localhost / the compose host. Guard first, work second.
- Seed data is fixed and versioned — no `faker`, no random ids. The same seed produces the
  same rows on every machine, otherwise tests aren't reproducible.
- Seed uses stable ids from the sample dataset (`REF-01`, `CV-01`, …) as the business key.
- The seed logs what it created vs what it skipped. Silence is not a success report.

---

## Testing

Two layers, both required. A step is not done until both exist for it.

**Unit / integration — Vitest**
- Location: the workspace `tests/` folder, mirroring the source path. Never colocated.
- Naming `[name].test.ts`.
- One `describe` per module, one `it` per behaviour, named as the behaviour
  (`it("flags an eliminatory requirement as a blocker")`), not as the function.
- LLM calls are mocked at the `lib/llm.ts` boundary. Never hit the real endpoint in a unit test.
- Fixtures (sample model responses, sample parsed pages) live in `tests/fixtures/` and are
  real captured payloads, not hand-written happy paths.
- Every zod schema gets a test with a malformed payload, not only a valid one.
- DB tests run against the compose Postgres with the migrations applied, inside a transaction
  that rolls back. No test writes rows that survive the test.
- No snapshot test on LLM output. Model output isn't stable; assert on the parsed shape and
  the invariants instead.

**E2E — Playwright**
- Location: `apps/web/e2e/`, specs named `[flow].spec.ts`.
- One spec per user-visible step. They run against the docker-compose stack with the seed
  applied, and are independent — any spec can run alone, in any order.
- Selectors: `data-testid`. Never a CSS class, never text that a copy change would break.
- The LLM is stubbed at the api boundary in E2E runs (env flag), so specs are deterministic
  and don't burn quota. One separate smoke spec may hit the real pipeline; it's allowed to be
  slow and is not in the default run.
- No `waitForTimeout`. Wait on a state, a response, or a testid.
- A failing E2E blocks the commit. It is not "flaky", it is failing.

---

## Git — commit, never push

Every feature and every fix ends with a commit. Not a batch of five features in one commit,
not a day of work left uncommitted in the working tree.

- **Commit after each feature or fix, as soon as it works.** One logical change per commit.
- **Never `git push`.** Never open a PR, never create a remote branch. Pushing is the human's
  call, always. The work stays local.
- Never `git commit --amend`, `git rebase`, `git reset --hard`, or force anything. History
  that already exists is not rewritten.
- Message format: `type(scope): imperative summary` — `feat(agents): extract eliminatory
  requirements`, `fix(seed): upsert references on REF id`. Types: `feat`, `fix`, `refactor`,
  `test`, `chore`, `docs`.
- Commit the migration in the same commit as the schema change that generated it.
- Do not commit with a failing test or a failing typecheck. Fix it, then commit.
- Never `git add .` blindly — stage the files the change actually touched.
- If a change spans web + api + shared, that's still one commit: it's one feature.

---

## Docker

- Multi-stage: `deps` → `build` → per-app runtime target. A runtime image never contains
  devDependencies or source TypeScript.
- Base `node:20-alpine`, pinned. No `latest` tags anywhere.
- Runs as a non-root user in the final stage.
- The root `.dockerignore` excludes `node_modules`, `.next`, `dist`, `.git`, `tests`, `e2e`,
  `data`, and `.env*` (but not `.env.example`).
- **No secret is ever baked into an image or written in a Dockerfile.** Secrets arrive as
  runtime env from compose / `.env`, which is gitignored. `.env.example` holds the keys with
  empty values.
- **One Dockerfile for the whole repo: `docker/Dockerfile`.** It has shared `deps` and
  `build` stages and three runtime targets — `api`, `web`, and the worker (which is the `api`
  image with a different command). Compose selects with `target:`. The install layer is built
  once and reused by both images; that is why it is one file.
- Build context is the repo root, because both apps need `packages/shared`. One root
  `.dockerignore` — a per-app one is never read with a root context.
- Never run api and web as two processes in one container. Separate targets, separate
  containers.
- Ports: api **3000**, web **3100**. `WEB_ORIGIN` on the api must match the web origin.
  `NEXT_PUBLIC_API_URL` is baked into the web bundle at build time, so it is a build arg.
- Compose services: `web`, `api`, `worker`, `postgres`, `redis`. Postgres and redis have
  healthchecks; api and worker use `depends_on: condition: service_healthy`.
- Postgres data on a named volume. Deleting containers must not delete the database.
- `docker compose up` on a clean clone starts everything and runs migrations + seed. That is
  the acceptance test for the compose file.
- Layer order: copy manifests, install, then copy source. Don't invalidate the install layer
  on every code change.

---

## Never do this

- ❌ Commit `.env`, a key, or a token
- ❌ Put business logic, SQL, or LLM calls in a route file
- ❌ Write prompt text outside `agents/<name>/prompts.ts`
- ❌ Fetch with `useEffect` + raw fetch, or `require()`
- ❌ Hardcode colors
- ❌ Use `any`
- ❌ Use `<form onSubmit>`
- ❌ Put business logic in components — extract to hooks, services, or utils
- ❌ Skip loading/error states
- ❌ Create new `.js` files in `components/` or `hooks/`
- ❌ `select *` in queries
- ❌ `useEffect` to sync server state — React Query does that
- ❌ Place a `.test.*` file next to the code it tests
- ❌ Duplicate a type between `web` and `api` instead of putting it in `packages/shared`
- ❌ Add a second LLM SDK, a second vector store, a second validation lib, or a state library
  nobody asked for
- ❌ `JSON.parse` an LLM response without `safeParse`, or cast it with `as`
- ❌ Hand-write an interface for something that already has a zod schema
- ❌ Write a query outside `db/[entity]Queries.ts`
- ❌ Edit a migration that has already been applied, or run `drizzle-kit push` on a shared DB
- ❌ Put `TRUNCATE`, `DROP`, or an unfiltered `DELETE` in the seed
- ❌ Use `faker` or random ids in seed data
- ❌ Hit the real LLM endpoint from a unit test or from the default E2E run
- ❌ Snapshot-test model output
- ❌ Use `waitForTimeout` in Playwright, or select by CSS class
- ❌ Bake a secret into an image, or use an unpinned `latest` base tag
- ❌ Run the container as root
- ❌ `git push`, open a PR, or create a remote branch — commit locally and stop
- ❌ Amend, rebase, or reset already-existing history
- ❌ Leave a finished feature or fix uncommitted
