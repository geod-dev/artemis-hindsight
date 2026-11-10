# /web - Frontend

The web app lives in `services/web` (Next.js: UI and the agent backend). Other services are in `services/` and `packages/`.

## assistant-ui

This project uses assistant-ui for chat interfaces.

Documentation: <https://www.assistant-ui.com/llms-full.txt>

Key patterns:

- Use AssistantRuntimeProvider at the app root
- Thread component for full chat interface
- AssistantModal for floating chat widget
- useChatRuntime hook with AI SDK transport

### Downloaded assistant-ui components: never edit them

The files under `services/web/src/components/assistant-ui/` (and any other file the registry
downloads) are copies of the official assistant-ui registry. **Never edit them, and never make a
local change to them for any reason.** If one of them doesn't do what we need, adapt our code around
it: write a wrapper or a new component in our own folders, and import the downloaded component as it is.

Why: a local edit is silently lost on the next download, and a later session cannot tell it apart
from upstream code.

Before downloading anything new, check whether our own code can do the job.

### Downloading components

Use the project script, not the shadcn CLI. It writes each file to the path the registry declares
(under `services/web/src/`) and follows registry dependencies:

```sh
cd services/web
node scripts/sync-assistant-ui.mjs --dry <item>...   # list the files it would write
node scripts/sync-assistant-ui.mjs <item>...         # write them
```

Item names are registry names; elements are `elements-<name>`. Check the registry for exact names.

## Docker

Always use the dev environment: `docker compose -f docker-compose.yml -f docker-compose.dev.yml ...`
(hot reload for web and toolbox). Use the plain `docker-compose.yml` only when the user asks for it or
when you are testing a production build.

Never run `docker compose down -v` or `docker volume rm` on the data volumes (`postgres-data`,
`hindsight-data`, `sandbox-data`, `sandbox-workspace`): they hold the database, the long-term memory and the
agent's files. After a dependency change, remove only `artemis-hindsight_node-modules`.

Rules:

- Download only what we use. Never download the whole catalog.
- Running the script again overwrites the downloaded files. Only run it for an item you intend to
  replace. It never touches our own code.
- Keep a download reviewable: a commit or step that changes registry files should not also change our code.
- Do not download `thread`, `elements-composer`, `elements-message-actions`, or `elements-tool-call`.
  `thread` keeps its user message, composer, and layout internal, so it can't be customized through
  slots. The other three either can't drop props or buttons, or don't fit our runtime. Our thread,
  composer, and message rows are our own code.
