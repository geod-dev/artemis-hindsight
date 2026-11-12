# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY services/toolbox/package.json services/toolbox/
RUN --mount=type=cache,target=/root/.npm npm ci --workspace @artemis/contracts --workspace @artemis/toolbox
COPY packages/contracts packages/contracts
COPY services/toolbox services/toolbox
RUN npm run build -w @artemis/contracts && npm run build -w @artemis/toolbox

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /repo/packages/contracts/package.json ./packages/contracts/
COPY --from=build /repo/services/toolbox/dist ./services/toolbox/dist
COPY --from=build /repo/services/toolbox/package.json ./services/toolbox/
USER node
EXPOSE 8080
CMD ["node", "/app/services/toolbox/dist/server.js"]
