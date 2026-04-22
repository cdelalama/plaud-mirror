FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY . .

RUN npm run build \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

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

RUN mkdir -p /var/lib/plaud-mirror/data /var/lib/plaud-mirror/recordings

EXPOSE 3040

CMD ["node", "apps/api/dist/cli/server.js"]
