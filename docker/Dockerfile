# ONE Dockerfile, three runtime targets: api, worker, web.
# Build context is the REPO ROOT (both apps need packages/shared).
#
#   docker build -f docker/Dockerfile --target api .
#   docker build -f docker/Dockerfile --target web .
#
# Compose picks the target per service:
#   api:    build: { context: ., dockerfile: docker/Dockerfile, target: api }
#   worker: the api IMAGE, command: node src/worker.js   (no build block)
#   web:    build: { context: ., dockerfile: docker/Dockerfile, target: web }
#
# `deps` is a SHARED stage: the install layer is built once and reused by both
# final images. That is the reason this is one file and not two.
#
# ---------------------------------------------------------------------------
# TODO: stage `deps`
#   FROM node:22-alpine pinned by digest. No :latest.
#   Copy ONLY the manifests — package.json, package-lock.json,
#   apps/api/package.json, apps/web/package.json, packages/shared/package.json —
#   then `npm ci`. Nothing else gets copied here, or every code change
#   invalidates the install.
#
# TODO: stage `build` (FROM deps)  — WEB ONLY
#   The api needs no build: it is JavaScript, ESM, and runs from source.
#   Copy the source and run `npm run build -w @tenderpilot/web`
#   (next.config.ts already sets output: 'standalone' and outputFileTracingRoot).
#   NEXT_PUBLIC_API_URL is baked into the bundle at build time -> ARG, not ENV.
#
# TODO: stage `api` (FROM node:22-alpine, the same pinned base)
#   `npm ci --omit=dev`, then copy apps/api/src and packages/shared/src.
#   No devDependencies. Nothing is compiled.
#   Non-root user. EXPOSE 3000. CMD ["node", "src/server.js"].
#   Startup runs migrations then the seed (see docker-compose.yml).
#   The worker runs this exact image with `command: node src/worker.js`.
#
# TODO: stage `web` (FROM node:22-alpine, the same pinned base)
#   Copy .next/standalone + .next/static + public from `build`.
#   Non-root user. ENV PORT=3100. EXPOSE 3100. CMD ["node", "server.js"].
#
# ---------------------------------------------------------------------------
# Ports: api 3000, web 3100.
# No secret is ever baked in. Secrets arrive as runtime env from compose / .env.
# NEXT_PUBLIC_* is public by definition — nothing sensitive goes there.
#
# The corpus at apps/api/src/db/seed/data/ is .dockerignore'd (it is gitignored too),
# so it is MOUNTED into api + worker by compose, not copied into the image.
#
# NOT DONE: running api and web as two processes inside ONE container. That needs a
# supervisor, hides a crash behind a live PID 1, and makes the two impossible to scale
# or restart independently. Separate targets, separate containers, one file.
