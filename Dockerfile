# Multi-stage build for BALTHASAR (Next.js 16 production + simple-deploy entrypoint).
# Produces a minimal standalone image (~180MB) that:
#   - runs Drizzle migrations on startup (entrypoint.sh)
#   - listens on 3000 in Asia/Shanghai TZ by default
#   - supports both amd64 + arm64 (built via buildx in CI)

# ---- Stage 1: deps ----
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Stage 2: build ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Dummy env vars for build-time validation (@t3-oss/env-nextjs)
# Real values are set at runtime via docker-compose.simple.yml
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
ENV BETTER_AUTH_SECRET=build-time-dummy-secret-not-used-at-runtime-minlen-32
ENV BETTER_AUTH_URL=http://localhost:3000

RUN pnpm build

# ---- Stage 3: runner (minimal runtime) ----
FROM node:22-alpine AS runner
WORKDIR /app

# simple-deploy (013): default TZ + pg_isready for entrypoint wait loop
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Shanghai

# pg_isready (used by entrypoint.sh to wait for postgres health)
RUN apk add --no-cache postgresql-client

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy standalone Next.js output (.next/standalone already contains server.js)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# simple-deploy (013): bake migrations + drizzle-kit + schema so entrypoint can run them
# without depending on the host's source tree.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/server/db/migrations ./src/server/db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/src/server/db/schema ./src/server/db/schema
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg ./node_modules/pg
COPY --from=builder --chown=nextjs:nodejs /app/docker/entrypoint.sh ./docker/entrypoint.sh
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3000

# entrypoint handles: wait pg → drizzle-kit migrate → exec node server.js
CMD ["sh", "docker/entrypoint.sh"]
