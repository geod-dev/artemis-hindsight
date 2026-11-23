// Usage backfill: an independent job. It reads what the database already holds and adds `model_usage` rows for the
// model calls made before usage was recorded: the chat replies and the conversation titles. It imports nothing from the
// app: only the database and the prompt files (read as data). Running it changes no code and no message.
//
//   npm run usage:backfill -w @artemis/web     (the migrate image runs it after the migrations, on every launch)
//
// Once per user: a user whose `tags` hold TAG is skipped. Each user is done in one transaction that ends by adding the
// tag, so a failed run leaves the user untagged and the next launch tries again. Rows are flagged `estimated`: the
// tokens come from the text (CHARS_PER_TOKEN), not from the provider. Prices are not stored: the usage page applies
// them when it reads the rows. Images and memory left no trace to estimate from.
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const TAG = "execute_model_usage_backfill";

/** Assumption: the average number of characters per token, for French and English text. */
const CHARS_PER_TOKEN = 3.5;
/** The naming call reads at most this many characters of the first message (server/agent/conversation-title.ts). */
const TITLE_INPUT_CHARS = 2000;
/** The placeholder name every new conversation starts with (server/repositories/conversation-repository.ts). */
const DEFAULT_TITLE = "New conversation";
/** The models the app used, for rows that do not say (the CHAT_MODEL and TITLE_MODEL settings and their defaults). */
const CHAT_MODEL = process.env.CHAT_MODEL ?? "claude-haiku-5-5";
const TITLE_MODEL = process.env.TITLE_MODEL ?? "claude-haiku-5-5";

type Sql = postgres.TransactionSql;
type Part = { type: string; text?: string };

interface MessageRow {
  id: string;
  role: string;
  parts: Part[];
  metadata: { model?: string; modelInput?: { text: string } } | null;
  created_at: Date;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = postgres(url, { max: 1 });
  const systemChars = promptChars("system-prompt.md");
  const titleChars = promptChars("conversation-title.md");
  // A JSON value goes through sql.json: a string passed for a jsonb column would be stored as a JSON string.
  const tag = sql.json([TAG]);

  try {
    const users = await sql<{ id: string }[]>`select id from users where not (tags @> ${tag})`;
    let replies = 0;
    let titles = 0;
    for (const { id: userId } of users) {
      await sql.begin(async (tx) => {
        replies += await backfillReplies(tx, userId, systemChars);
        titles += await backfillTitles(tx, userId, titleChars);
        await tx`update users set tags = tags || ${tag} where id = ${userId}`;
      });
    }
    console.log(`usage backfill: ${replies} replies and ${titles} titles estimated for ${users.length} users`);
  } finally {
    await sql.end();
  }
}

/** One estimated `chat` row for each assistant reply of the user that has none. */
async function backfillReplies(sql: Sql, userId: string, systemChars: number): Promise<number> {
  const counted = new Set(
    (await sql<{ message_id: string }[]>`
      select message_id from model_usage where user_id = ${userId} and message_id is not null
    `).map((row) => row.message_id),
  );
  const conversations = await sql<{ id: string }[]>`select id from conversations where user_id = ${userId}`;

  let recorded = 0;
  for (const { id } of conversations) {
    const history = await sql<MessageRow[]>`
      select id, role, parts, metadata, created_at from messages where conversation_id = ${id} order by position
    `;
    // The model read the system prompt and every earlier message, then wrote the reply. One call per reply: a reply
    // with several tool steps resent the prompt at each step, so its input is underestimated.
    let readChars = systemChars;
    for (const message of history) {
      const chars = charsOf(message);
      if (message.role === "assistant" && !counted.has(message.id)) {
        await sql`
          insert into model_usage (user_id, part, message_id, model, input_tokens, output_tokens, estimated, created_at)
          values (${userId}, 'chat', ${message.id}, ${message.metadata?.model ?? CHAT_MODEL},
                  ${tokens(readChars)}, ${tokens(chars)}, true, ${message.created_at})
          on conflict (message_id) do nothing
        `;
        recorded += 1;
      }
      readChars += chars;
    }
  }
  return recorded;
}

/**
 * One estimated `title` row for each conversation of the user that was named and has none. A conversation still
 * carrying the placeholder its first message gives was never named.
 */
async function backfillTitles(sql: Sql, userId: string, titleChars: number): Promise<number> {
  const counted = new Set(
    (await sql<{ conversation_id: string | null }[]>`
      select metadata->>'conversationId' as conversation_id from model_usage where user_id = ${userId} and part = 'title'
    `).flatMap((row) => (row.conversation_id ? [row.conversation_id] : [])),
  );
  // Temporary chats are never named.
  const conversations = await sql<{ id: string; title: string }[]>`
    select id, title from conversations where user_id = ${userId} and temporary is null
  `;

  let recorded = 0;
  for (const conversation of conversations) {
    if (counted.has(conversation.id) || conversation.title === DEFAULT_TITLE) continue;
    const userMessages = await sql<{ parts: Part[]; created_at: Date }[]>`
      select parts, created_at from messages where conversation_id = ${conversation.id} and role = 'user' order by position
    `;
    const first = userMessages.map((row) => ({ text: textOf(row.parts), at: row.created_at })).find((row) => row.text);
    if (!first || conversation.title === placeholderTitle(first.text)) continue;

    // The naming call read its prompt and the start of the first message, and wrote the title.
    const input = titleChars + Math.min(first.text.length, TITLE_INPUT_CHARS);
    await sql`
      insert into model_usage (user_id, part, model, input_tokens, output_tokens, metadata, estimated, created_at)
      values (${userId}, 'title', ${TITLE_MODEL}, ${tokens(input)}, ${Math.max(1, tokens(conversation.title.length))},
              ${sql.json({ conversationId: conversation.id })}, true, ${first.at})
    `;
    recorded += 1;
  }
  return recorded;
}

function tokens(chars: number): number {
  return Math.round(chars / CHARS_PER_TOKEN);
}

/** The length of a prompt file in prompts/, as the model read it. */
function promptChars(file: string): number {
  return readFileSync(path.join(process.cwd(), "prompts", file), "utf8").trim().length;
}

/** What a message weighed in a request: the exact text the model read for a user message, else its text and tool calls. */
function charsOf(message: MessageRow): number {
  if (message.role === "user" && message.metadata?.modelInput) return message.metadata.modelInput.text.length;
  return message.parts.reduce((sum, part) => {
    if (part.type === "text") return sum + (part.text?.length ?? 0);
    if (part.type.startsWith("tool-") || part.type === "dynamic-tool") return sum + JSON.stringify(part).length;
    return sum;
  }, 0);
}

function textOf(parts: Part[]): string {
  return parts
    .flatMap((part) => (part.type === "text" && part.text !== undefined ? [part.text] : []))
    .join("")
    .trim();
}

/** The placeholder a first message gives a conversation: the rule of titleFrom in conversation-repository.ts. */
function placeholderTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return DEFAULT_TITLE;
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

main().catch((error: unknown) => {
  console.error("usage backfill failed", error);
  process.exit(1);
});
