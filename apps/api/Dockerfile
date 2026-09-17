# Multi-stage: deps -> build -> runner.
# TODO: FROM node:20-alpine pinned by digest. No :latest.
# TODO: deps   - copy manifests ONLY, install. Layer order matters: do not invalidate
#                the install layer on every code change.
# TODO: build  - copy source, tsc
# TODO: runner - production deps + compiled JS only. No devDependencies, no .ts source.
# TODO: create and USE a non-root user in the final stage.
# TODO: no secrets. Ever. They arrive as runtime env from compose.
# The worker reuses THIS image with a different command. No third Dockerfile.
