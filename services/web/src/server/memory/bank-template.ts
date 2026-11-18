import { readFileSync } from "node:fs";
import path from "node:path";
import { deleteBank as deleteHindsightBank, importBankTemplate } from "../clients/hindsight-client";

// How every user's memory bank is set up, following https://hindsight.vectorize.io/best-practices:
//   - missions for retain (what to extract), consolidation (which observations to build) and reflect (how to answer),
//     each in prompts/<name>.md so they can be edited without touching code;
//   - the disposition of a personal assistant (skepticism 2, literalism 2, empathy 4);
//   - narrow mental models, one per knowledge dimension, refreshed after each consolidation. Reflect reads them first.
//
// The template is applied with Hindsight's bank template import, which is idempotent: config fields are written as
// bank overrides, and a mental model whose definition is unchanged is skipped (no regeneration). It is applied when a
// bank is created, and once per process before the first retain or consolidation of each bank, so a changed prompt
// reaches every bank after a deploy.
//
// No tags or entity labels: each user has their own bank, and nothing filters memories by tag. Add them with a filter
// that needs them.

/** The retain strategy used for conversation transcripts. Documents retained earlier name it, so the name stays. */
export const CONVERSATION_STRATEGY = "conversation";

/** The time zone of the family. Times the extraction reads without an offset ("at 3 pm") are in this zone. */
const TIME_ZONE = "Europe/Paris";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const cache = new Map<string, string>();

/** Same caching as the system prompt: read on every call in development, once per process in production. */
function prompt(name: "retain" | "observations" | "reflect"): string {
  if (process.env.NODE_ENV === "production" && cache.has(name)) return cache.get(name) as string;
  const text = readFileSync(path.join(PROMPTS_DIR, `${name}.md`), "utf8").trim();
  cache.set(name, text);
  return text;
}

/** Refreshed in delta mode after each consolidation, so a model keeps its unchanged sections and costs little. */
const MENTAL_MODEL_TRIGGER = { refresh_after_consolidation: true, mode: "delta" } as const;

const MENTAL_MODELS = [
  {
    id: "user-profile",
    name: "User profile",
    source_query:
      "Who is the user? Name, age, where they live, their work or studies, their health, their daily routines and " +
      "their stated goals.",
  },
  {
    id: "family-and-close-people",
    name: "Family and close people",
    source_query:
      "Who are the people in the user's life? For each: name, relationship to the user, age or birthday, and what " +
      "matters about them now.",
  },
  {
    id: "current-plans",
    name: "Current projects and plans",
    source_query:
      "What is the user working on or planning right now? Active projects, upcoming events and appointments, " +
      "deadlines, commitments and what blocks them.",
  },
  {
    id: "preferences",
    name: "Preferences and communication style",
    // Where the user lives and works belongs to the profile; this model is about tastes and how to talk to them.
    source_query:
      "What does the user like and dislike (food, music, hobbies, products, tools), and how do they want the " +
      "assistant to answer (language, tone, length, format, way of working together)?",
  },
].map((model) => ({
  ...model,
  // Each model is read as a summary: what is known, not a list of what the memories lack.
  source_query: `${model.source_query} State only what the memories hold; do not list what is missing.`,
  max_tokens: 1024,
  trigger: MENTAL_MODEL_TRIGGER,
}));

export function bankTemplate() {
  return {
    version: "1",
    bank: {
      retain_strategies: { [CONVERSATION_STRATEGY]: { retain_mission: prompt("retain") } },
      retain_default_strategy: CONVERSATION_STRATEGY,
      observations_mission: prompt("observations"),
      reflect_mission: prompt("reflect"),
      disposition_skepticism: 2,
      disposition_literalism: 2,
      disposition_empathy: 4,
      default_timezone: TIME_ZONE,
    },
    mental_models: MENTAL_MODELS,
  };
}

/** Banks set up by this process. A failed setup is forgotten, so the next call tries again. */
const applied = new Map<string, Promise<void>>();

/** Applies the template to the bank, creating it when it does not exist. Always sends it, and remembers it as applied. */
export function applyBankTemplate(bankId: string): Promise<void> {
  const run = importBankTemplate(bankId, bankTemplate());
  applied.set(bankId, run);
  run.catch(() => {
    if (applied.get(bankId) === run) applied.delete(bankId);
  });
  return run;
}

/** Applies the template once per process for this bank. */
export function ensureBankTemplate(bankId: string): Promise<void> {
  return applied.get(bankId) ?? applyBankTemplate(bankId);
}

/** Creates the user's memory bank with the template. Idempotent: an existing bank only gets the template again. */
export function createBank(bankId: string): Promise<void> {
  return applyBankTemplate(bankId);
}

/** Deletes the user's memory bank and everything in it. */
export async function deleteBank(bankId: string): Promise<void> {
  applied.delete(bankId);
  await deleteHindsightBank(bankId);
}

/**
 * Empties the user's memory: the bank is deleted and created again with the template. Hindsight's own "clear memories"
 * keeps the conversation documents, so the next append to a conversation would extract the cleared facts again.
 */
export async function clearMemory(bankId: string): Promise<void> {
  await deleteBank(bankId);
  await createBank(bankId);
}
