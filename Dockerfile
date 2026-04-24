ARG BUILD_BASE_IMAGE=node:20-bookworm-slim
ARG RUNTIME_BASE_IMAGE=node:20-bookworm-slim

FROM ${BUILD_BASE_IMAGE} AS build

# Use Docker's default /bin/sh for RUN. All the commands below are POSIX
# (no arrays, no [[, no process substitution), so bash is unnecessary and
# forcing it would break Alpine-based base images (which ship ash via
# busybox, not bash). See docs/operations/DEPLOY_PLAYBOOK.md — alpine is
# listed as an acceptable fallback.

WORKDIR /app

RUN command -v node >/dev/null 2>&1 \
  && command -v corepack >/dev/null 2>&1 \
  && corepack enable

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack npm ci

COPY . .

RUN corepack npm run build:runtime \
  && corepack npm run build --workspace @plaud-mirror/web \
  && corepack npm prune --omit=dev

FROM ${RUNTIME_BASE_IMAGE} AS runtime

# Same reason as the build stage: POSIX /bin/sh suffices and keeps the
# Alpine fallback documented in DEPLOY_PLAYBOOK actually executable.

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3040
ENV PLAUD_MIRROR_PORT=3040
ENV PLAUD_MIRROR_DATA_DIR=/var/lib/plaud-mirror/data
ENV PLAUD_MIRROR_RECORDINGS_DIR=/var/lib/plaud-mirror/recordings
ENV PLAUD_MIRROR_WEB_DIST_DIR=/app/apps/web/dist

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/VERSION ./VERSION

RUN command -v node >/dev/null 2>&1 \
  && mkdir -p /var/lib/plaud-mirror/data /var/lib/plaud-mirror/recordings \
  && chown -R 1000:1000 /app /var/lib/plaud-mirror

# Run as non-root. UID:GID 1000:1000 matches the `node` user on the official
# node:*-bookworm-slim images and the typical dev-vm host user, so bind-mounted
# volumes under ./runtime/ end up owned by the host user rather than root.
# Custom base images that do not ship a UID 1000 user still work because
# USER accepts numeric IDs.
USER 1000:1000

EXPOSE 3040

CMD ["node", "apps/api/dist/cli/server.js"]
