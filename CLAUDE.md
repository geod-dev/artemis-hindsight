# Artemis Hindsight: project guide

A chat app with a server-side agent, used by a family. Three clients-facing parts and a shared package:

- `services/web`: Next.js. The web UI and the agent backend (API routes in `src/app/api`). Auth, database, memory and the agent loop live here.
- `services/toolbox`: the tools the agent calls, over HTTP. Contract in `packages/contracts/src/tools.ts`.
- `services/sandbox`: the per-conversation file sandbox (uploads, generated files, command execution).
- `packages/contracts`: wire schemas and types shared by the services. Each service validates its inputs with these.
- `apps/mobile`: the Expo (React Native) client for Android and iOS. See "Mobile app" below.

Root scripts run the workspaces (`npm run typecheck` checks `packages/*` and `services/*`).

## Rule: web and mobile move together

Both clients expose the same features. A change to a feature (chat, streaming, attachments, visuals, conversation
list, settings, memory, skills, admin) is made in **both** `services/web` and `apps/mobile` in the same piece of work.

- If a backend change is needed by a feature, both clients are updated against it in that same change.
- If one client cannot do it yet, say so in the final message and name the gap. Do not leave a silent difference.
- Backend APIs used by the mobile app stay JSON and keep bearer-token auth working. `getCurrentUser` accepts
  `Authorization: Bearer <token>` or the web session cookie. Do not add a route that only works with cookies.
- Shared behaviour (stream protocol, visual languages, avatar colors, sandbox file links) must match on both sides.
  The web and mobile copies say where they come from in a comment.

## Streaming and turns (backend)

- A turn runs on the server. The HTTP response is only a view of it. A client that disconnects, reloads, or switches
  conversation does **not** stop the turn. Only `POST /api/chat/[id]/stop` stops it.
- One turn at a time per conversation. A message sent while a reply runs waits in a queue (`acquireTurn` in
  `turn-registry.ts`) and starts after that reply ends. Never start a second stream on the same conversation.
- Unread replies: when a turn ends with no client reading its stream, `conversations.unread` is set. Opening the
  conversation (`GET /api/conversations/[id]/messages` or the web page) clears it, and so does sending a message.
  The conversation list shows a dot. Viewers are counted per stream by `watchViewers`.
- Joining a running turn: `GET /api/conversations/[id]/messages` and the web page return `activeStreamId`. A client
  that opens the conversation reads `/api/chat/resume/<streamId>` to follow the turn from its start.
- Storage of pending turns is per conversation on both clients. A reply running in one conversation is never resumed
  in another.
- Turn state is in memory (`turn-registry.ts`). A server restart ends running turns; the messages saved so far stay.
- Live lists: `GET /api/events` (cookie or bearer) sends a `changed` event whenever one of the user's lists (conversations
  or projects) changes, from any window or device. Every repository write that changes a list calls
  `announceListChange(userId)` (`server/events/list-events.ts`). A new write that changes a list must announce too.
  Clients read the lists again on `changed`: the web app in `LiveUpdates`, the phone in `useLiveListUpdates`.

## Branches (edit and regenerate)

- A conversation is a tree: `messages.parent_id`. An edit is a new user message beside the edited one; a regenerate is a
  new assistant message beside the old reply. `position` is insertion order across all branches (sibling order).
- `conversations.active_leaf_id` is the branch the user is on (the clients open on it, every device). A turn moves it to
  the new message, then to its reply. A branch switch is `POST /api/conversations/[id]/branch` (refused while a reply
  runs). `messages.visited_at` lets the clients reopen each fork on the branch visited last (`use-branch-memory.ts`).
- The model, memory and any new feature that reads a conversation read **one branch** (`branchTo`), never every row.
- Memory: `conversations.memorized_leaf_id` is the branch in Hindsight. A flush appends when the active branch continues
  it, and replaces the conversation's document with the active branch when the user left it (`memory-flush.ts`).
- Clients load the whole tree (`tree` in the messages JSON, assistant-ui's `messageRepository`). `messages` stays the
  active branch alone, for older phone builds.

## Temporary chats

- `conversations.temporary` is `personalized`, `unpersonalized` or null. A temporary chat is never listed, named, made
  active or saved to memory. A new query that lists conversations or sends them to memory must leave them out.
- Unpersonalized: the agent gets no `<user_metadata>`, memory, skills, project, memory tools or username
  (`chat-turn.ts`). The sandbox has no path guard, so this hides the user from the agent's context; it is not isolation.
- Open pages call `POST /api/conversations/[id]/keepalive` every 5 minutes (web `TemporaryChatKeepAlive`, phone the
  same name). An hourly sweep (`server/conversations/temporary-chats.ts`) deletes chats not kept alive for an hour.

## Model calls and costs

- Every model call made for a user is one row of `model_calls` (`server/usage/model-calls.ts`): one row per request
  to a provider, with its context, operation, cause, model, tokens and cost. A new feature that calls a model records
  its calls there.
- Tokens come from what the provider reported for that request (AI SDK `usage`, OpenAI's `usage`, Hindsight's request
  log), never from estimates. `source_key` is the provider's id for the request, so a call is never counted twice.
- A call is priced once, when it is recorded (`server/usage/prices.ts`). A price change never reprices the past. A new
  model needs its price there.
- A reply records each step from `streamText`'s `onStepEnd`, against the reply's id (chosen before the stream starts).
- Memory calls run inside Hindsight: `server/usage/memory-calls.ts` copies them from its request log every 15 minutes and
  before the usage page is read. Retain stays async.

## Mobile app (`apps/mobile`)

- Expo SDK 58, Expo Router, TypeScript. It is **not** an npm workspace: its React version differs from the web's, so
  it has its own `node_modules`. Run `npm install` inside `apps/mobile`. Keep `apps/mobile/.npmrc`
  (`legacy-peer-deps`): `lucide-react-native` declares a React 18 peer, and EAS's clean install fails without it.
- Chat: `@assistant-ui/react-native` primitives (`ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`, ...) with
  `@assistant-ui/ai-sdk` and the AI SDK transport. Install only `@assistant-ui/react-native` for the native side, never
  `@assistant-ui/react`.
- Other libraries: TanStack Query (server state), `react-native-marked` (markdown), `react-native-gifted-charts`
  (charts), `react-native-webview` (Mermaid, from the same CDN build the web uses), `expo-audio` (dictation),
  `expo-document-picker` and `expo-file-system` / `expo-sharing` (files), `expo-secure-store` (the session token),
  `@react-native-async-storage/async-storage` (preferences and the server address).
- Keyboard: the app is edge-to-edge on Android, so the window never resizes. The chat and the login screen move with
  `useReanimatedKeyboardAnimation` (react-native-keyboard-controller) through `translateY` or padding. Do not use React
  Native's `KeyboardAvoidingView` there, and do not add `automaticOffset` or measured offsets.
- The server address and the token are chosen at sign-in and stored on the device. Nothing secret is baked into the
  bundle; `EXPO_PUBLIC_SERVER_URL` only sets a default.
- Type check: `npm run typecheck` inside `apps/mobile`.
- Run on a phone: `npm run android` (development build, USB debugging) for native changes. JS changes can be tested
  with `npm run start`.

### Shipping a mobile change

A push to `main` does not reach the phones by itself. After the push, publish:

1. Typecheck `apps/mobile` and the root (`npm run typecheck`).
2. JavaScript-only change: publish an over-the-air update with `npm run update -- "message"` (branch `production`). The
   APK's `preview` channel points at that branch. Phones pick it up on their next launch, sometimes the second one.
3. Native change (a new native module, `app.json` plugins or permissions, an Expo SDK upgrade): OTA cannot ship it.
   Build an APK with `npx eas-cli build --platform android --profile preview --non-interactive` (EAS cloud; the free
   queue can take an hour), then `npm run distribute`. It sends the newest finished preview APK to every tester of the
   Firebase project. Tell the owner explicitly in the final message that a new APK was sent.

Rules:

- Keep the application id (`com.artemis.mobile`) stable. A different id is a separate app on the phone.
- Versions follow the way the change ships:
  - **OTA** (`npm run update`): keep the version as it is. The runtime version (`appVersion`, from `expo.version` in
    `app.json`) must not change, or the OTA stops reaching the installed APK.
  - **Rebuild + Firebase App Distribution** (a new APK): the version **must** change, with a new build, a minor or a
    major version. Bump `expo.version` in `app.json` and `version` in `apps/mobile/package.json` together, so the
    testers' APK is identifiable and the runtime version matches the new APK.
- The tester list lives in the Firebase console (App Distribution, Testers & groups), not in the repo.
- Expo and Firebase logins belong to the owner: never log in on their behalf, ask them to run the command.

## assistant-ui (web)

This project uses assistant-ui for chat interfaces.

Documentation: <https://www.assistant-ui.com/llms-full.txt>

Key patterns:

- Use AssistantRuntimeProvider at the app root
- Thread component for full chat interface
- AssistantModal for floating chat widget
- useChatRuntime hook with AI SDK transport

### Downloaded assistant-ui components: never edit them

The files under `services/web/src/components/assistant-ui/` (and any other file the registry downloads) are copies
of the official assistant-ui registry. **Never edit them, and never make a local change to them for any reason.** If
one of them doesn't do what we need, adapt our code around it: write a wrapper or a new component in our own
folders, and import the downloaded component as it is.

Why: a local edit is silently lost on the next download, and a later session cannot tell it apart from upstream code.

Before downloading anything new, check whether our own code can do the job.

### Downloading components

Use the project script, not the shadcn CLI. It writes each file to the path the registry declares (under
`services/web/src/`) and follows registry dependencies:

```sh
cd services/web
node scripts/sync-assistant-ui.mjs --dry <item>...   # list the files it would write
node scripts/sync-assistant-ui.mjs <item>...         # write them
```

Item names are registry names; elements are `elements-<name>`. Check the registry for exact names.

Rules:

- Download only what we use. Never download the whole catalog.
- Running the script again overwrites the downloaded files. Only run it for an item you intend to replace. It never
  touches our own code.
- Keep a download reviewable: a commit or step that changes registry files should not also change our code.
- Do not download `thread`, `elements-composer`, `elements-message-actions`, or `elements-tool-call`. `thread` keeps
  its user message, composer, and layout internal, so it can't be customized through slots. The other three either
  can't drop props or buttons, or don't fit our runtime. Our thread, composer, and message rows are our own code.
  The mobile app follows the same rule: it builds its thread and composer from the primitives.
- The mobile composer element (`assistant-ui.com/elements/mobile-composer`) is web-only: shadcn, DOM, `<form>`.
  There is no React Native registry item for it (`r.assistant-ui.com/native/elements-mobile-composer` returns 404),
  and the native page only lists primitives. The mobile composer is therefore built from `ComposerPrimitive`, modeled on
  the web element's behaviour (quick actions that fold away with the keyboard, attach, single-line input, send that
  becomes stop). It is our own code.

## Database

- The schema is `services/web/src/server/db/schema.ts` (Drizzle, Postgres).
- To change it: edit the schema, then `cd services/web && npx drizzle-kit generate --name <short_name>`. Commit the
  generated SQL and its `meta` files together with the schema change.
- Never edit a migration that has already been applied. Add a new one.
- Apply: `npm run db:migrate -w @artemis/web`. Do this before testing a change that needs the new column.

## Docker

Always use the dev environment: `docker compose -f docker-compose.yml -f docker-compose.dev.yml ...` (hot reload for
web and toolbox). Use the plain `docker-compose.yml` only when the user asks for it or when you are testing a
production build.

Never run `docker compose down -v` or `docker volume rm` on the data volumes (`postgres-data`, `hindsight-data`,
`sandbox-data`, `sandbox-workspace`): they hold the database, the long-term memory and the agent's files. After a
dependency change, remove only `artemis-hindsight_node-modules`.

The mobile app runs outside Docker. The server it talks to must be reachable from the phone (LAN address or public
URL), not `localhost`.

## Checks before reporting a change as done

- `npm run typecheck` at the root (services and packages).
- `npm run typecheck` inside `apps/mobile`.
- A change to streaming, unread or conversation switching is checked by hand on the web **and** on a phone, with a
  reply running while the conversation is switched.
- Say what was not checked.

## Working conventions

- Prefer libraries over hand-written UI, auth or protocol code. Use shadcn and popular packages.
- When the owner is away, make the calls, keep them small and list them in the final message.

## UI: match the design system, reuse components

The product is meant to look premium, so new UI must look like the rest of the app, not like a new one.

- Before writing a control, look for an existing one: `services/web/src/components/ui` (shadcn: Button, Badge,
  Dialog, AlertDialog, DropdownMenu, Input, Textarea, Skeleton, Sheet, Tooltip) and the shared components of
  `components/`. Use them, with className overrides when needed. Do not hand-build a button, badge, menu, dialog or
  input that shadcn already provides. For a missing shadcn component, add it with the shadcn registry.
- Surfaces come from the design system's tokens: `components/assistant-ui/elements/surfaces.ts` (`floating` for
  popovers and dialogs, `field` for input backgrounds, `ghostButton` for icon buttons). Do not write a new background or
  border colour when a token exists.
- **The look lives in `components/ui`, not at call sites.** The shadcn files there are ours: their defaults are the
  design system. A call site passes `className` only for layout (width, flex, gap, margin, overflow), never for colour,
  radius, padding, border or shadow. If a screen needs a different look, add a variant to the primitive (as `pill` on
  Button) and use it everywhere that look appears.
- Radius tokens (`globals.css`): menus and dialogs are `rounded-surface` (1rem). The composer has its own radius,
  concentric with its round buttons (`--composer-radius` in `thread.tsx`).
  Every control (buttons, inputs, textareas, toggles, menu rows) is `rounded-control` (surface − `--surface-inset`), so
  a row padded by the inset inside a menu is concentric with it. Containers and settings sections are `rounded-xl`;
  badges, pills, tabs and picker triggers are `rounded-full`. Dialog padding is `p-5`. Never write a literal radius
  such as `rounded-[10px]`.
- Settings pages render `SettingsPage` (`components/settings/settings-page.tsx`): one full width, padding, header and
  spacing for all of them. Rows of things (skills, danger zone actions, archived chats) are `SettingsList` +
  `SettingsRow`, never a hand-built card. A button that removes something is `variant="outline-destructive"`.
- One component per job. One choice out of a few (a page's sections, a view switch) is `Tabs`, even without
  `TabsContent`; its selected pill slides (`sliding-indicator.tsx`). `ToggleGroup` is only for filters, where several
  items can be on. A menu choice is a `DropdownMenuRadioItem`, shown by a check on the right, never a dot.
- Mobile: no shadcn there. Reuse the shared components of `apps/mobile/src/components` (ActionSheet, ColorSwatches,
  ProjectIcon) and the palette of `preferences.tsx`. Before writing a new control, check `apps/mobile/package.json` for
  a library that already provides it, and say in the final message when a control is hand-built and why.
- Web and mobile share the same look: a feature that exists on both uses the same radius, surfaces and colours, and
  the same component structure where the platforms allow it.
