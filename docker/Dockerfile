# ONE Dockerfile, three runtime targets: api, worker, web.
# Build context is the REPO ROOT (both apps need packages/shared).
#
#   docker build -f docker/Dockerfile --target api .
#   docker build -f docker/Dockerfile --target web .
#
# Compose picks the target per service:
#   api:    build: { context: ., dockerfile: docker/Dockerfile, target: api }
#   worker: the api IMAGE, command: node dist/worker.js   (no build block)
#   web:    build: { context: ., dockerfile: docker/Dockerfile, target: web }
#
# deps and build are SHARED stages: the install layer is built once and reused by
# both final images. That is the reason this is one file and not two.
#
# ---------------------------------------------------------------------------
# TODO: stage `deps`
#   FROM node:20-alpine pinned by digest. No :latest.
#   Copy ONLY the manifests — root package.json + lockfile, apps/api/package.json,
#   apps/web/package.json, packages/shared/package.json — then install.
#   Nothing else gets copied here, or every code change invalidates the install.
#
# TODO: stage `build` (FROM deps)
#   Copy the source. Build packages/shared first, then apps/api (tsc) and
#   apps/web (next build, output: 'standalone').
#   NEXT_PUBLIC_API_URL is baked into the web bundle at build time -> ARG, not ENV.
#
# TODO: stage `api` (FROM node:20-alpine, the same pinned base)
#   Copy production node_modules + apps/api/dist + packages/shared/dist from build.
#   No devDependencies, no .ts source.
#   Non-root user. EXPOSE 3000. CMD ["node", "dist/server.js"].
#   The worker runs this exact image with a different command.
#
# TODO: stage `web` (FROM node:20-alpine, the same pinned base)
#   Copy the standalone bundle + .next/static + public from build.
#   Non-root user. ENV PORT=3100. EXPOSE 3100. CMD ["node", "server.js"].
#
# ---------------------------------------------------------------------------
# Ports: api 3000, web 3100.
# No secret is ever baked in. Secrets arrive as runtime env from compose / .env.
# NEXT_PUBLIC_* is public by definition — nothing sensitive goes there.
#
# NOT DONE: running api and web as two processes inside ONE container. That needs a
# supervisor, hides a crash behind a live PID 1, and makes the two impossible to scale
# or restart independently. Separate targets, separate containers, one file.
