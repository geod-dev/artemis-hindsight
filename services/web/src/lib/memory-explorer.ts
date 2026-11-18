// The memory explorer's data, as the web app's routes send it (app/api/memory/*) and the settings page reads it.
// Shaped from Hindsight's API by server/memory/memory-explorer.ts.

/** The three kinds of memory a bank stores. World facts and experiences come from conversations; observations are
 * consolidated from them. */
export type MemoryType = "observation" | "world" | "experience";

export const MEMORY_TYPES: readonly MemoryType[] = ["observation", "world", "experience"];

export function isMemoryType(value: unknown): value is MemoryType {
  return value === "observation" || value === "world" || value === "experience";
}

/** How two memories are linked. Hindsight's "caused_by" is shown as "causal". */
export type LinkType = "semantic" | "temporal" | "entity" | "causal";

export const LINK_TYPES: readonly LinkType[] = ["semantic", "temporal", "entity", "causal"];

export interface MemoryItem {
  id: string;
  type: MemoryType;
  text: string;
  /** When the memory was mentioned in a conversation. */
  mentionedAt: string | null;
  /** When what it describes happened, when the memory says so. */
  occurredStart: string | null;
  occurredEnd: string | null;
  entities: string[];
  /** Observations: how many facts support it. */
  proofCount: number | null;
}

export interface MemoryLink {
  source: string;
  target: string;
  type: LinkType;
  weight: number;
}

export interface MemoryList {
  items: MemoryItem[];
  links: MemoryLink[];
  /** How many memories of this type the bank holds; more than `items.length` when the list was capped. */
  total: number;
}

/** A memory a detail points to: an observation's source fact, a mental model's evidence, an entity's mention. */
export interface MemoryRef {
  id: string;
  type: MemoryType | "mental_model";
  text: string;
  /** Observation history: this fact arrived with that change. */
  isNew?: boolean;
}

export interface MemoryDetail {
  id: string;
  type: MemoryType;
  text: string;
  /** The retain context: where the memory comes from. */
  context: string | null;
  /** "valid", or "invalidated" for a forgotten memory. */
  state: string;
  mentionedAt: string | null;
  occurredStart: string | null;
  occurredEnd: string | null;
  consolidatedAt: string | null;
  editedAt: string | null;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  documentId: string | null;
  chunkId: string | null;
  tags: string[];
  /** The entities it mentions. `id` is null when the name matches no entity of the bank. */
  entities: { name: string; id: string | null }[];
  /** Observations: the facts it was consolidated from. */
  sources: MemoryRef[];
  /** Observations: how the text changed, newest first. */
  history: { changedAt: string; previousText: string; sources: MemoryRef[] }[];
}

export interface EntityItem {
  id: string;
  name: string;
  mentions: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface EntityLink {
  source: string;
  target: string;
  /** How many memories mention both entities. */
  weight: number;
}

export interface EntityList {
  items: EntityItem[];
  links: EntityLink[];
}

export interface EntityDetail extends EntityItem {
  /** The facts that mention the entity, newest first. */
  memories: MemoryRef[];
  /** The entities mentioned together with it, most often first. */
  related: { id: string; name: string; weight: number }[];
}

export interface MentalModelItem {
  id: string;
  name: string;
  /** The question the model answers. */
  sourceQuery: string | null;
  /** Markdown. */
  content: string;
  lastRefreshedAt: string | null;
  refreshFailedAt: string | null;
  /** New memories in its scope since the last refresh. */
  stale: boolean;
  /** The memories and models the content was built from. */
  evidence: MemoryRef[];
}

export interface MentalModelDetail extends MentalModelItem {
  createdAt: string | null;
  lastFullRefreshAt: string | null;
  /** "delta" edits the content in place; "full" rewrites it. */
  refreshMode: string | null;
  refreshAfterConsolidation: boolean;
  refreshCron: string | null;
  /** Earlier versions, newest first. */
  history: { changedAt: string; previousContent: string }[];
}

export interface MemorySummary {
  observation: number;
  world: number;
  experience: number;
  entities: number;
  mentalModels: number;
}
