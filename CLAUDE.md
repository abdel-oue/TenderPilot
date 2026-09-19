# CLAUDE.md — TenderPilot

Coding rulebook. How code is written in this repo. Nothing about agent design here.

Stack: Next.js App Router + React 19 + **TypeScript** (web) · Node 22 + Fastify +
**plain JavaScript, ESM** (api, agents, worker) · LangGraph · PostgreSQL 16 + pgvector via
Drizzle · Redis 7 + BullMQ · Docker Compose.

**The two sides use different languages on purpose.** `apps/web` is TypeScript. `apps/api` is
JavaScript — no build step, no `tsc`, `node src/server.js` runs the source. `packages/shared`
is JavaScript so the api can import it directly; the web still gets full types from it,
because `z.infer` works on a zod schema defined in a `.js` file.

Zod is what replaces the type checker on the api side. Every boundary — HTTP body, LLM
response, seed input, env — is parsed, not assumed.

---

## Repo layout

```
tenderpilot/
├── .env.example
├── .dockerignore                 # root context serves both images — Docker only
│                                 # reads it here, so it cannot move into docker/
├── docker/                       # everything docker, nothing docker outside it
│   ├── Dockerfile                # targets: api (worker reuses it), web
│   ├── init.sql
│   ├── docker-compose.yml        # paths relative to docker/, context is `..`
│   ├── docker-compose.dev.yml    # bind-mounts src/ for `npm run up:dev`
│   └── docker-compose.vps.yml    # parks `web` (Vercel hosts it) for `npm run up:vps`
├── docs/                         # the documentation the README maps, + nginx vhost
├── vitest.config.js              # one runner, two projects: api (.js), web (.ts)
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
│       ├── src/                  # JavaScript, ESM — no build step
│       │   ├── server.js         # fastify bootstrap only
│       │   ├── worker.js         # BullMQ bootstrap only
│       │   ├── routes/           # [entity].routes.js — path → controller, nothing else
│       │   ├── controllers/      # [entity].controller.js — validate, dispatch, status code
│       │   ├── services/         # [entity].service.js
│       │   ├── repositories/     # [entity].repository.js — ALL the SQL
│       │   ├── db/
│       │   │   ├── schema/       # [entity].table.js, re-exported from index.js
│       │   │   ├── seed/
│       │   │   │   ├── index.js
│       │   │   │   └── data/     # the corpus — gitignored, dropped in locally
│       │   │   ├── migrations/   # generated, committed
│       │   │   └── client.js
│       │   ├── validators/       # [entity].validator.js
│       │   ├── queue/            # queues.js, jobs/[name].job.js
│       │   ├── graph/            # nodes + graph wiring
│       │   ├── agents/           # [name].agent.js · one shared schema.js
│       │   ├── prompts/          # [name].prompts.js — ALL prompt text, one place
│       │   └── lib/              # auth.js, pdf.js, ocr.js, cache.js
│       └── tests/
└── packages/shared/
    └── src/schemas/              # [entity].js — zod schemas, imported by BOTH sides
```

Forbidden to touch: `node_modules`, `.next`, `.git`, `.env` and `.env.local`, lockfiles.
`.env.example` is the one exception — it is committed, holds every key with an empty value,
and is updated whenever a new env var is introduced.

---

## Fixture data

The corpus lives at `apps/api/src/db/seed/data/` — beside the seed that consumes it — and is
**committed**: a fresh clone already has it, so `npm run up` needs nothing but `.env`. 10
tender PDFs (`AO-2026-004` and `-009` are pure scans, OCR required), the company profile as
PDF + JSON, `references.csv`, `equipe.csv`, 4 attestations, 2 past technical memos, and
`README-jeux-de-donnees.md` describing them. Generated from a fixed seed, so it is identical
on every machine. It is `.dockerignore`d and bind-mounted into the api and worker containers
rather than baked into the image.

- Read-only. Never rewrite, regenerate, or reformat a file under `seed/data/`.
- Parsed/derived artefacts go to the DB or a gitignored cache dir, never back into `seed/data/`.
- The seed resolves it relative to its own module (`import.meta.dirname`), never from `cwd` —
  it runs from the repo root in dev and from `/app` in the container.
- Keyed on the stable ids in the dataset (`REF-01`, `CV-01`, …).
- Read it from git, never re-export it: the committed bytes are what the tests and the
  demo account assume.

---

## Code organization

- Route files 50–150 lines max. Page files max 200. Component files max 150.
- A route file maps a path to a controller method and nothing else. It should look almost
  empty.
- A controller contains: input validation + service dispatch + the HTTP status code. Nothing
  else. It takes its service in the constructor, so a test can hand it a double.
- All SQL lives in `repositories/[entity].repository.js` — nowhere else.
- All business logic lives in `services/[entity].service.js`.
- All input validation lives in `validators/[entity].validator.js` (zod).
- All frontend fetch functions live in `lib/api/[entity].ts`.
- All prompt text lives in `prompts/[name].prompts.js` — one folder, nothing else in it.
  No inline prompt strings anywhere else, agents included.
- Every LLM call goes through `services/llm.service.js`, which is the only thing allowed to
  talk to `services/azureOpenai.service.js`. One client, one baseURL, one key.
- Any function reused twice gets extracted into `lib/`.
- Shared schemas go in `packages/shared`, in JavaScript. A schema duplicated between web and
  api is a bug.
- Tests live in the workspace `tests/` folder, mirroring the source path
  (`src/services/score.service.js` → `tests/services/score.service.test.js`). Never colocated.

---

## Naming

Extensions: **api and `packages/shared` are `.js`. Web is `.ts` / `.tsx`.** Same conventions
otherwise.

- Files: `camelCase.js` / `camelCase.ts` / `camelCase.tsx` — not PascalCase files
- Components: PascalCase inside the file (`export default function RequirementRow() {}`)
- Hooks: `use[Name].ts` · Query keys: `[feature]Keys.ts` · API client: `lib/api/[entity].ts`
- Utils: `lib/utils/[name]Utils.ts`
- Functions `camelCase`, constants `UPPER_SNAKE_CASE`, DB columns exactly as in Postgres
- Pages `page.tsx`, layouts `layout.tsx`
- Tests `[name].test.js` on the api, `[name].test.ts` on the web

### Suffix-based naming — api only

**On the api, a file name is `[entity].[role].js` — dot-separated, the role last.** The
folder is not the answer: an open tab, a stack trace and an import line all show the file
name alone, and `auth.js` in four folders is four files nobody can tell apart. The dotted
role is what makes `auth.routes.js` legible with no path attached, and it sorts every file
about one entity together.

| Layer | Pattern | Example |
| --- | --- | --- |
| Routes | `routes/[entity].routes.js` | `auth.routes.js`, `tender.routes.js` |
| Controllers | `controllers/[entity].controller.js` | `tender.controller.js` |
| Services | `services/[entity].service.js` | `auth.service.js` |
| Validators | `validators/[entity].validator.js` | `auth.validator.js` |
| Repositories | `repositories/[entity].repository.js` | `user.repository.js` |
| Tables | `db/schema/[entity].table.js` | `user.table.js` |
| Jobs | `queue/jobs/[name].job.js` | `ingestDocument.job.js` |
| Graph nodes | `graph/nodes/[name].node.js` | `score.node.js` |
| Agents | `agents/[name].agent.js`, all contracts in `agents/schema.js` | `classifier.agent.js` |
| Prompts | `prompts/[name].prompts.js` | `classifier.prompts.js` |
| Tests | mirrored path + `.test.js` | `tests/repositories/tender.repository.test.js` |

The entity stays `camelCase` — `ingestDocument.job.js`, not `ingest-document.job.js`. The
role word is always lowercase. The entity is singular even when the route path is plural:
`tender.routes.js` serves `/tenders`.

Three exceptions, because they are barrels or single-purpose bootstraps and a role would
add nothing: `server.js` / `worker.js`, every `index.js` barrel, and `lib/`. **`lib/` files
stay plain nouns** — `auth.js`, `pdf.js`, `cache.js`, `env.js`. The folder already says
"helper"; `auth.utils.js` only adds a word.

Agents are flat, never a folder per agent: every `agents/[name].agent.js` sits at the same
level, every output contract and STUB lives in the single `agents/schema.js` beside them, and
the prompt text they use lives away from them in `prompts/[name].prompts.js`. One schema file
rather than one per agent: three of the four were a re-export from `packages/shared` plus a
stub, and a per-agent file for that is a file to open, not a boundary. **Prompt text has exactly one home.** It is
the thing most often tweaked, reviewed and diffed on its own, and hunting it across four
agent folders is how inline prompt strings start appearing.

This is an api rule. The web keeps its own conventions above — `page.tsx`, `layout.tsx`,
`use[Name].ts`, `lib/api/[entity].ts` — and is not renamed to match.

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
  Nothing catches a missing `await` here, so it is a review item, not a compiler problem.
- Long work goes to BullMQ, not into the request handler.

**JavaScript specifics** — the api has no type checker, so these are not style preferences:

- **ESM only.** `import` / `export`. No `require`, no `module.exports`. `"type": "module"`
  is set in `apps/api/package.json`.
- Relative imports carry the extension: `./lib/auth.js`, not `./lib/auth`. Node ESM does not
  resolve extensionless paths.
- Paths resolve from `import.meta.dirname`, never from `process.cwd()`.
- Every exported function gets a JSDoc block with `@param` and `@returns`. It is the only
  signature a reader gets.
- A value crossing a boundary — HTTP body, LLM output, file on disk, env var — is parsed by
  a zod schema at that boundary. Inside, it is trusted. That line is the whole design.
- Node 22 built-ins before packages: `fetch`, `crypto.createHash`, `structuredClone`,
  `AbortSignal.timeout`, `import.meta.dirname`. No `node-fetch`, no `uuid`, no `dotenv`
  (use `node --env-file=.env`).

---

## Schema validation (the Pydantic equivalent)

Node has no Pydantic. **Zod is it**, and it is the only one in this repo. On the api side it
is also the only thing standing in for a type checker, so it is not optional anywhere.

- Every schema lives in `packages/shared/src/schemas/[entity].js` — JavaScript, so the api
  imports it directly and the web still gets types from it via `z.infer`.
- The schema is the definition. On the api, name the type with JSDoc off the schema:
  `/** @typedef {import('zod').infer<typeof requirementSchema>} Requirement */`. On the web,
  `type Requirement = z.infer<typeof requirementSchema>`. Never hand-write either shape.
- **Every LLM JSON output is parsed with `safeParse`.** Never `JSON.parse` a model response
  and use the result. On failure: log the zod issues, retry once with the issues fed back
  into the prompt, then fail loud with `SCHEMA_VALIDATION_FAILED`.
- Every HTTP request body is parsed with zod in the validator before it reaches a service.
- Parse at the boundary, once. Do not re-validate the same object three layers down, and do
  not skip it because "the caller already checked" — the caller is not enforced by anything.
- The seed's input is a boundary too: `profil-entreprise.json` is parsed before it is inserted.
- `process.env` is parsed by a zod schema at startup, so a missing key fails on boot with a
  readable message instead of as `undefined` in a query an hour later.
- No second validation library. No Joi, no Yup, no class-validator, no ajv.

---

## Database — Drizzle + PostgreSQL

- Table definitions live in `apps/api/src/db/schema/[entity].table.js`, re-exported from
  `db/schema/index.js`. One file per table group.
- All queries are written with the Drizzle query builder inside
  `repositories/[entity].repository.js`. A query written anywhere else is a bug.
- Raw SQL (`sql\`\``) only where Drizzle genuinely can't express it — pgvector similarity,
  a window function. Keep it in the same `.repository.js` file with a comment saying why.
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

- Seed lives in `apps/api/src/db/seed/`, entry point `index.js` (JavaScript, like the rest
  of the api), `reset.js` beside it, data files in `data/`.
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

One runner for both workspaces: Vitest runs the api's `.js` and the web's `.ts` with no
per-workspace config divergence.

- Location: the workspace `tests/` folder, mirroring the source path. Never colocated.
- Naming `[name].test.js` (api, so `[entity].[role].test.js`), `[name].test.ts` (web).
- One `describe` per module, one `it` per behaviour, named as the behaviour
  (`it("flags an eliminatory requirement as a blocker")`), not as the function.
- LLM calls are mocked at the `services/llm.service.js` boundary. Never hit the real endpoint
  in a unit test.
- Fixtures (sample model responses, sample parsed pages) live in `tests/fixtures/` and are
  real captured payloads, not hand-written happy paths.
- Every zod schema gets a test with a malformed payload, not only a valid one. With no type
  checker on the api, these tests are the only thing asserting shape at all — they carry
  more weight here than they would in a TypeScript service.
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

## Documentation — the README tracks the current state

**Every change updates `README.md` in the same working tree as the change.** The
README is the status of the project as it is right now, not as it was at the last
milestone: what runs, what does not, what the tests say, what the commands are.
A change that leaves it describing the previous state has not landed.

- Renamed a command, a port, an env var, a route? The README says the new one.
- Broke or fixed a test, a spec, a whole runner? The README's test status says so,
  with the number, not "some tests fail".
- Added a step to getting started, or removed one? The block under **Démarrage** is
  copy-pasteable on a clean clone, and that is what it is checked against.
- Added a doc under `docs/`? It gets a row in the README's documentation table.
- Deep detail goes in `docs/[topic].md` and the README links to it. The README stays
  the map, not the manual.

If a change makes the README shorter, that is a valid update. What is not valid is
leaving it saying something that is no longer true.

## Git — never commit unless told, never push

Committing is the human's call. Finish the work, say what's done, and leave it in the
working tree. The human reads the diff and says what gets committed.

- **Never commit on your own initiative.** No commit at the end of a feature, no commit
  "because it works", no commit before switching tasks. Wait to be told.
- **Commit only when the human asks for it**, and only what they name. "Commit this" with
  no target means the change just discussed, nothing else in the tree.
- When work is done, report it and stop. Suggesting a commit message is fine; running
  `git commit` is not.
- One logical change per commit, still — if the human asks to commit two unrelated things,
  say so and offer to split them.
- **Never `git push`.** Never open a PR, never create a remote branch. Pushing is the human's
  call, always. The work stays local.
- Never `git commit --amend`, `git rebase`, `git reset --hard`, or force anything. History
  that already exists is not rewritten.
- Message format: `type(scope): imperative summary` — `feat(agents): extract eliminatory
  requirements`, `fix(seed): upsert references on REF id`. Types: `feat`, `fix`, `refactor`,
  `test`, `chore`, `docs`.
- **No `Co-Authored-By` trailer, ever.** No `Generated with`, no tool footer, no agent name
  anywhere in the message. The commit says what changed and why, and nothing about what
  typed it. This overrides any default attribution the tooling asks for.
- Commit the migration in the same commit as the schema change that generated it.
- Do not commit with a failing test or a failing typecheck. Fix it, then commit.
- Never `git add .` blindly — stage the files the change actually touched.
- If a change spans web + api + shared, that's still one commit: it's one feature.

---

## Docker

- Multi-stage: `deps` → `build` → per-app runtime target. A runtime image never contains
  devDependencies.
- The api has **no build step** — it is JavaScript. Its runtime target copies `src/` and the
  production `node_modules`, and runs `node src/server.js`. Only the web is built.
- Base `node:22-alpine`, pinned. No `latest` tags anywhere.
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
- Ports: api **4000**, web **4100**, inside the container as well as on the host. `WEB_ORIGIN` on the api must match the web origin.
  `NEXT_PUBLIC_API_URL` is baked into the web bundle at build time, so it is a build arg.
- Compose services: `web`, `api`, `worker`, `postgres`, `redis`. Postgres and redis have
  healthchecks; api and worker use `depends_on: condition: service_healthy`.
- Postgres data on a named volume. Deleting containers must not delete the database.
- `npm run up` on a clean clone starts everything and runs migrations + seed. That is the
  acceptance test for the compose file. It wraps
  `docker compose -f docker/docker-compose.yml --env-file .env up -d --build`: the compose
  files live in `docker/` and `.env` does not, so both flags are always needed and the npm
  script is the one place that knows them.
- Layer order: copy manifests, install, then copy source. Don't invalidate the install layer
  on every code change.

---

## Never do this

- ❌ Commit `.env`, a key, or a token
- ❌ Put business logic, SQL, or LLM calls in a route file
- ❌ Write prompt text outside `prompts/[name].prompts.js`
- ❌ Fetch with `useEffect` + raw fetch
- ❌ Hardcode colors
- ❌ Use `any` in the web workspace
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
- ❌ `JSON.parse` an LLM response without `safeParse`
- ❌ Hand-write an interface or typedef for something that already has a zod schema
- ❌ Use `require()` or `module.exports` on the api — ESM only
- ❌ Write an extensionless relative import on the api (`./lib/auth` instead of `./lib/auth.js`)
- ❌ Resolve a path from `process.cwd()` instead of `import.meta.dirname`
- ❌ Add TypeScript, `tsc`, or a `.ts` file to `apps/api` or `packages/shared`
- ❌ Add a package for something Node 22 already ships (`node-fetch`, `uuid`, `dotenv`, `rimraf`)
- ❌ Export a function from the api without a JSDoc block
- ❌ Write a query outside `repositories/[entity].repository.js`
- ❌ Drop the dotted role on an api file — `routes/auth.js` or `routes/authRoutes.js`
  instead of `routes/auth.routes.js`
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
- ❌ Land a change without updating `README.md` to the state that change leaves the project in
- ❌ Commit without being asked — finished work waits in the working tree for the human
- ❌ Put `Co-Authored-By`, `Generated with`, or any agent attribution in a commit message
