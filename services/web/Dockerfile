# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).
# Two images from one build: `runtime` (the default, last stage) is the web app; `migrate` is the one-shot job that
# applies the database schema. Both are kept small: exporting and unpacking a large image on the server is what made
# deploys slow.
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY services/web/package.json services/web/
RUN --mount=type=cache,target=/root/.npm npm ci --workspace @artemis/contracts --workspace @artemis/web
COPY packages/contracts packages/contracts
COPY services/web services/web
RUN npm run build -w @artemis/contracts
RUN --mount=type=cache,target=/repo/services/web/.next/cache npm run build -w @artemis/web
# The migration script and its two dependencies (drizzle-orm, postgres) in one file, so the migrate image needs no
# node_modules. esbuild comes with tsx.
RUN node_modules/.bin/esbuild services/web/src/server/db/migrate.ts --bundle --platform=node --target=node22 \
    --outfile=services/web/dist/migrate.cjs

FROM node:22-bookworm-slim AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/services/web/dist/migrate.cjs ./
COPY --from=build /repo/services/web/drizzle ./drizzle
USER node
CMD ["node", "migrate.cjs"]

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
