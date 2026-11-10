# Build context: repository root (see docker-compose.yml).
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY services/sandbox/package.json services/sandbox/
RUN npm ci --workspace @artemis/contracts --workspace @artemis/sandbox
COPY packages/contracts packages/contracts
COPY services/sandbox services/sandbox
RUN npm run build -w @artemis/contracts && npm run build -w @artemis/sandbox

FROM node:22-bookworm-slim AS runtime
# The tools the agent is likely to need. Keep this list short; add more in the image, not at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends bash ca-certificates curl git jq python3 python3-venv ripgrep \
 && rm -rf /var/lib/apt/lists/*
# Default Python environment: `python3` and `pip` resolve here. Owned by the runtime user so the agent can install into it.
RUN python3 -m venv /opt/venv && chown -R node:node /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
ENV NODE_ENV=production PORT=8080 DATA_ROOT=/data WORKSPACE_ROOT=/workspace
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /repo/packages/contracts/package.json ./packages/contracts/
COPY --from=build /repo/services/sandbox/dist ./services/sandbox/dist
COPY --from=build /repo/services/sandbox/package.json ./services/sandbox/
RUN mkdir -p /data /workspace && chown -R node:node /data /workspace
USER node
WORKDIR /workspace
EXPOSE 8080
CMD ["node", "/app/services/sandbox/dist/server.js"]
