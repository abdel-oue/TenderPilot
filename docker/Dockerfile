# ONE Dockerfile, three runtime targets: api, worker, web.
# Build context is the REPO ROOT (both apps need packages/shared).
#
#   docker build -f docker/Dockerfile --target api .
#   docker build -f docker/Dockerfile --target web .
#
# `deps` is a SHARED stage: the install layer is built once and reused by both
# final images. That is the reason this is one file and not two.

# Pinned to a patch version, never :latest.
FROM node:22.20.0-alpine3.21 AS base

# ---------------------------------------------------------------------------
# deps — manifests only, so a source change never invalidates the install.
# ---------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# ---------------------------------------------------------------------------
# build — WEB ONLY. The api is JavaScript and runs from source.
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
# NEXT_PUBLIC_* is baked into the client bundle at build time, so it is an ARG.
# Public by definition — nothing sensitive goes here.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY packages/shared/src packages/shared/src
COPY apps/web apps/web
RUN npm run build -w @tenderpilot/web

# ---------------------------------------------------------------------------
# api — also the worker image (same image, different command).
# ---------------------------------------------------------------------------
FROM base AS api
WORKDIR /app

# pdftoppm (poppler) rasterizes the scanned dossiers, tesseract reads them.
# AO-2026-004 and AO-2026-009 have no text layer at all, so this is not optional.
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-fra tesseract-ocr-data-eng

ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev

COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src
COPY apps/api/drizzle.config.js apps/api/

# The uploads volume mounts here. Created and chowned BEFORE the volume is
# declared so docker copies this ownership onto the new volume - otherwise it is
# root-owned and the non-root user cannot write a single upload.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
VOLUME /app/uploads

USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "src/server.js"]

# ---------------------------------------------------------------------------
# web — Next standalone bundle only. No source, no devDependencies.
# ---------------------------------------------------------------------------
FROM base AS web
WORKDIR /app
ENV NODE_ENV=production PORT=4100 HOSTNAME=0.0.0.0

# outputFileTracingRoot is the repo root, so the standalone tree mirrors the
# workspace: the server entry lands at apps/web/server.js, not ./server.js.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

USER node
EXPOSE 4100
CMD ["node", "apps/web/server.js"]
