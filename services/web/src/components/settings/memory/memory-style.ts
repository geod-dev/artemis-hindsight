import type { LinkType, MemoryRef, MemoryType } from "@/lib/memory-explorer";

// Names and colors of the memory explorer. Colors are CSS tokens of globals.css, so they follow the theme.

export type RefType = MemoryRef["type"];

export const TYPE_STYLE: Record<RefType, { label: string; plural: string; token: string }> = {
  observation: { label: "Observation", plural: "Observations", token: "--memory-observation" },
  world: { label: "World fact", plural: "World facts", token: "--memory-world" },
  experience: { label: "Experience", plural: "Experiences", token: "--memory-experience" },
  mental_model: { label: "Mental model", plural: "Mental models", token: "--memory-mental-model" },
};

export const ENTITY_TOKEN = "--memory-entity";

export const LINK_STYLE: Record<LinkType, { label: string; token: string; description: string }> = {
  semantic: { label: "Semantic", token: "--memory-link-semantic", description: "Similar meaning" },
  temporal: { label: "Temporal", token: "--memory-link-temporal", description: "Close in time" },
  entity: { label: "Entity", token: "--memory-link-entity", description: "Share an entity" },
  causal: { label: "Causal", token: "--memory-link-causal", description: "One led to the other" },
};

/**
 * Links shown when a graph first opens. Entity links join almost every pair of memories that mention the user, so
 * they hide the structure until asked for.
 */
export const DEFAULT_LINKS: LinkType[] = ["semantic", "temporal", "causal"];

export const MEMORY_TYPE_EMPTY: Record<MemoryType, string> = {
  observation:
    "No observations yet. They are built from facts when the memory is consolidated, every day at 5 AM or from the developer settings.",
  world: "No world facts yet. Talk to Artemis, and what it learns about you shows up here.",
  experience: "No experiences yet. They record what Artemis did or promised in your conversations.",
};

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** "Nov 18, 2026, 4:20 PM"; the raw value if it does not parse; an empty string for none. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

/** "Nov 18, 2026", for list rows. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateOnly.format(date);
}

/**
 * When a memory happened: one day, a range, or nothing. Hindsight stores a whole day as 00:00 to 23:59:59, which reads
 * as that day.
 */
export function formatOccurred(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  const from = start ? new Date(start) : null;
  const to = end ? new Date(end) : null;
  if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
    const sameDay = from.toDateString() === to.toDateString();
    if (sameDay) return dateOnly.format(from);
    return `${dateOnly.format(from)} – ${dateOnly.format(to)}`;
  }
  return formatDay(start ?? end);
}

// A tag is "Key: value" where the key is one or two words, e.g. "Involving: user" or "When: 2026-11-18".
const TAG = /^(\p{L}+(?: \p{L}+)?):\s*(.*)$/u;

/** A fact reads "Sentence | Involving: user | Why it matters": its sentences, in order, and its tags. */
export function splitMemoryText(text: string): { sentences: string[]; tags: { key: string; value: string }[] } {
  const sentences: string[] = [];
  const tags: { key: string; value: string }[] = [];
  for (const part of text.split(" | ")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = trimmed.match(TAG);
    if (match?.[1] && match[2] !== undefined && sentences.length > 0) tags.push({ key: match[1], value: match[2] });
    else sentences.push(trimmed);
  }
  return { sentences, tags };
}

/** The first sentence of a memory, for list rows and graph previews. */
export function memoryHeadline(text: string): string {
  return splitMemoryText(text).sentences[0] ?? text;
}

/** Markdown without its syntax, for previews of a mental model. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
