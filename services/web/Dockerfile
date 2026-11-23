# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).
# Two images from one file: `migrate` is the one-shot job that applies the database schema, `runtime` (the default,
# last stage) is the web app. Both are kept small: exporting and unpacking a large image on the server is what made
# deploys slow.
# `migrate` does not depend on the Next.js build: it only needs the dependencies and the migration script. So starting
# `migrate` (for example `docker compose up --build` in development) does not run `next build`.
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY services/web/package.json services/web/
RUN --mount=type=cache,target=/root/.npm npm ci --workspace @artemis/contracts --workspace @artemis/web

# The migration script and its two dependencies (drizzle-orm, postgres) in one file, so the migrate image needs no
# node_modules. esbuild comes with tsx. The usage backfill (src/jobs/usage-backfill.ts) is a separate job bundled the
# same way: it runs after the migrations and reads the prompts in prompts/ as data.
FROM deps AS migrate-build
COPY services/web/src/server/db services/web/src/server/db
COPY services/web/src/jobs services/web/src/jobs
COPY services/web/drizzle services/web/drizzle
RUN node_modules/.bin/esbuild services/web/src/server/db/migrate.ts --bundle --platform=node --target=node22 \
    --outfile=services/web/dist/migrate.cjs \
 && node_modules/.bin/esbuild services/web/src/jobs/usage-backfill.ts --bundle --platform=node --target=node22 \
    --outfile=services/web/dist/usage-backfill.cjs

FROM node:22-bookworm-slim AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=migrate-build /repo/services/web/dist/migrate.cjs /repo/services/web/dist/usage-backfill.cjs ./
COPY --from=migrate-build /repo/services/web/drizzle ./drizzle
COPY services/web/prompts ./prompts
USER node
# The backfill never blocks the launch: when it fails, its users stay untagged and the next launch tries again.
CMD ["sh", "-c", "node migrate.cjs && { node usage-backfill.cjs || echo 'usage backfill failed, retried at next launch'; }"]

FROM deps AS build
COPY packages/contracts packages/contracts
COPY services/web services/web
RUN npm run build -w @artemis/contracts
RUN --mount=type=cache,target=/repo/services/web/.next/cache npm run build -w @artemis/web

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
# Monorepo layout: the standalone folder mirrors the repo, so the server is at services/web/server.js. The server
# serves public/ and .next/static only when they are copied next to it.
COPY --from=build --chown=node:node /repo/services/web/.next/standalone ./
COPY --from=build /repo/services/web/.next/static ./services/web/.next/static
COPY --from=build /repo/services/web/public ./services/web/public
USER node
EXPOSE 3000
CMD ["node", "services/web/server.js"]
