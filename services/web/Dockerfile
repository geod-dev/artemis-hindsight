# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).
# One image serves two roles: the web app (`next start`) and the one-shot migrate job (`db:migrate`).
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY services/sandbox/package.json services/sandbox/
COPY services/toolbox/package.json services/toolbox/
COPY services/web/package.json services/web/
RUN --mount=type=cache,target=/root/.npm npm ci
COPY packages/contracts packages/contracts
COPY services/web services/web
RUN npm run build -w @artemis/contracts
RUN --mount=type=cache,target=/repo/services/web/.next/cache npm run build -w @artemis/web
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/contracts ./packages/contracts
COPY --from=build /repo/services/web ./services/web
WORKDIR /repo/services/web
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
