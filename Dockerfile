# syntax=docker/dockerfile:1

# Single production image: NestJS serves the API under /api and the built
# web app (SPA + PWA) for every other route.

ARG NODE_VERSION=24
ARG PNPM_VERSION=11.0.8

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app

# ---- build: install the workspace, build web and api, prune api deps ----
FROM base AS build
# No git hooks, Nx daemon or Nx Cloud inside the image build.
ENV HUSKY=0 NX_DAEMON=false NX_NO_CLOUD=true

# Manifests first so dependency installation is cached across code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY libs/shared/schemas/package.json libs/shared/schemas/
COPY libs/shared/utils/package.json libs/shared/utils/
RUN pnpm install --frozen-lockfile

COPY . .
# `api:prune` builds the api and writes a pruned package.json, lockfile and
# workspace libraries to apps/api/dist.
RUN pnpm nx run-many -t build -p web \
  && pnpm nx run api:prune

# ---- prod-deps: install only the api's production dependencies ----
FROM base AS prod-deps
WORKDIR /app/api
COPY --from=build /app/apps/api/dist ./
RUN pnpm install --prod --frozen-lockfile

# ---- runtime: plain Node image with compiled output (no pnpm) ----
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST_DIR=/app/web

WORKDIR /app/api
COPY --from=prod-deps /app/api ./
COPY --from=build /app/apps/web/dist /app/web

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "main.js"]
