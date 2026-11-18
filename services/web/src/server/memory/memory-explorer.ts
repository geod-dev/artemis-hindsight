import { z } from "zod";
import { readBank } from "../clients/hindsight-client";
import type {
  EntityDetail,
  EntityList,
  LinkType,
  MemoryDetail,
  MemoryList,
  MemoryRef,
  MemorySummary,
  MemoryType,
  MentalModelDetail,
  MentalModelItem,
} from "@/lib/memory-explorer";
import { isMemoryType } from "@/lib/memory-explorer";

// The memory explorer of the settings: what a user's bank holds, read from Hindsight and shaped for the page
// (lib/memory-explorer.ts). Read only; deleting a memory is forgetMemory in the Hindsight client.

/** The most memories, entities or links one tab loads. The page says so when a bank holds more. */
const LIST_LIMIT = 1000;

/** Hindsight sends a missing value as null, as "" or as "N/A", depending on the endpoint. */
const text = z
  .string()
  .nullish()
  .transform((value) => (value && value.trim() && value !== "N/A" ? value : null));
const date = text;

const LINK_TYPES: Record<string, LinkType> = {
  semantic: "semantic",
  temporal: "temporal",
  entity: "entity",
  caused_by: "causal",
};

/** Hindsight sends a memory's entities as "A, B, C" in lists and as an array in a memory's detail. */
function entityNames(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const names = Array.isArray(value) ? value : value.split(",");
  return names.map((name) => name.trim()).filter(Boolean);
}

export async function memorySummary(bankId: string): Promise<MemorySummary> {
  const totalOf = (body: unknown, key: "total_units" | "total") =>
    z.object({ [key]: z.number() }).parse(body)[key] as number;
  const [observation, world, experience, entities, mentalModels] = await Promise.all([
    readBank(bankId, "/graph", { type: "observation", limit: 0 }).then((body) => totalOf(body, "total_units")),
    readBank(bankId, "/graph", { type: "world", limit: 0 }).then((body) => totalOf(body, "total_units")),
    readBank(bankId, "/graph", { type: "experience", limit: 0 }).then((body) => totalOf(body, "total_units")),
    readBank(bankId, "/entities", { limit: 1 }).then((body) => totalOf(body, "total")),
    readBank(bankId, "/mental-models", { limit: 1 }).then((body) => totalOf(body, "total")),
  ]);
  return { observation, world, experience, entities, mentalModels };
}

const graphSchema = z.object({
  edges: z.array(
    z.object({
      data: z.object({ source: z.string(), target: z.string(), linkType: z.string().nullish(), weight: z.number().nullish() }),
    }),
  ),
  table_rows: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      mentioned_at: date,
      occurred_start: date,
      occurred_end: date,
      entities: z.string().nullish(),
      proof_count: z.number().nullish(),
    }),
  ),
  total_units: z.number(),
});

/** The memories of one type, with the links between them. */
export async function listMemories(bankId: string, type: MemoryType): Promise<MemoryList> {
  const body = graphSchema.parse(await readBank(bankId, "/graph", { type, limit: LIST_LIMIT }));
  const ids = new Set(body.table_rows.map((row) => row.id));
  const links = body.edges.flatMap(({ data }) => {
    const linkType = LINK_TYPES[data.linkType ?? ""];
    if (!linkType || !ids.has(data.source) || !ids.has(data.target) || data.source === data.target) return [];
    return [{ source: data.source, target: data.target, type: linkType, weight: data.weight ?? 1 }];
  });
  return {
    items: body.table_rows.map((row) => ({
      id: row.id,
      type,
      text: row.text,
      mentionedAt: row.mentioned_at,
      occurredStart: row.occurred_start,
      occurredEnd: row.occurred_end,
      entities: entityNames(row.entities),
      proofCount: type === "observation" ? (row.proof_count ?? null) : null,
    })),
    links,
    total: body.total_units,
  };
}

const refSchema = z.object({ id: z.string(), text: z.string(), type: z.string().nullish(), is_new: z.boolean().nullish() });

function toRef(ref: z.infer<typeof refSchema>): MemoryRef | null {
  const type = ref.type ?? "";
  if (!isMemoryType(type)) return null;
  return { id: ref.id, type, text: ref.text, ...(ref.is_new ? { isNew: true } : {}) };
}

const memorySchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.string(),
  context: text,
  state: z.string().nullish(),
  mentioned_at: date,
  occurred_start: date,
  occurred_end: date,
  consolidated_at: date,
  edited_at: date,
  invalidated_at: date,
  invalidation_reason: text,
  document_id: text,
  chunk_id: text,
  tags: z.array(z.string()).nullish(),
  entities: z.union([z.array(z.string()), z.string()]).nullish(),
  source_memories: z.array(refSchema).nullish(),
});

const memoryHistorySchema = z.array(
  z.object({ changed_at: z.string(), previous_text: z.string().nullish(), source_facts: z.array(refSchema).nullish() }),
);

const entityListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      canonical_name: z.string(),
      mention_count: z.number().nullish(),
      first_seen: date,
      last_seen: date,
    }),
  ),
});

/** Every entity of the bank, by lowercase name: a memory names its entities, the explorer opens them by id. */
async function entityIdsByName(bankId: string): Promise<Map<string, string>> {
  const body = entityListSchema.parse(await readBank(bankId, "/entities", { limit: LIST_LIMIT }));
  return new Map(body.items.map((entity) => [entity.canonical_name.toLowerCase(), entity.id]));
}

/** One memory with everything Hindsight knows about it. Null when the bank has no such memory. */
export async function memoryDetail(bankId: string, memoryId: string): Promise<MemoryDetail | null> {
  const path = `/memories/${encodeURIComponent(memoryId)}`;
  const raw = await readBank(bankId, path);
  if (raw === null) return null;
  const memory = memorySchema.parse(raw);
  if (!isMemoryType(memory.type)) return null;

  const [history, entityIds] = await Promise.all([
    memory.type === "observation"
      ? readBank(bankId, `${path}/history`).then((body) => memoryHistorySchema.parse(body ?? []))
      : Promise.resolve([]),
    entityIdsByName(bankId),
  ]);

  return {
    id: memory.id,
    type: memory.type,
    text: memory.text,
    context: memory.context,
    state: memory.state ?? "valid",
    mentionedAt: memory.mentioned_at,
    occurredStart: memory.occurred_start,
    occurredEnd: memory.occurred_end,
    consolidatedAt: memory.consolidated_at,
    editedAt: memory.edited_at,
    invalidatedAt: memory.invalidated_at,
    invalidationReason: memory.invalidation_reason,
    documentId: memory.document_id,
    chunkId: memory.chunk_id,
    tags: memory.tags ?? [],
    entities: entityNames(memory.entities).map((name) => ({ name, id: entityIds.get(name.toLowerCase()) ?? null })),
    sources: (memory.source_memories ?? []).flatMap((ref) => toRef(ref) ?? []),
    history: history
      .map((change) => ({
        changedAt: change.changed_at,
        previousText: change.previous_text ?? "",
        sources: (change.source_facts ?? []).flatMap((ref) => toRef(ref) ?? []),
      }))
      .sort(newestFirst),
  };
}

const entityGraphSchema = z.object({
  edges: z.array(z.object({ data: z.object({ source: z.string(), target: z.string(), weight: z.number().nullish() }) })),
});

/** Every entity of the bank, and how often each pair is mentioned together. */
export async function listEntities(bankId: string): Promise<EntityList> {
  const [list, graph] = await Promise.all([
    readBank(bankId, "/entities", { limit: LIST_LIMIT }).then((body) => entityListSchema.parse(body)),
    readBank(bankId, "/entities/graph", { limit: LIST_LIMIT }).then((body) => entityGraphSchema.parse(body)),
  ]);
  const ids = new Set(list.items.map((entity) => entity.id));
  return {
    items: list.items.map((entity) => ({
      id: entity.id,
      name: entity.canonical_name,
      mentions: entity.mention_count ?? 0,
      firstSeen: entity.first_seen,
      lastSeen: entity.last_seen,
    })),
    links: graph.edges.flatMap(({ data }) =>
      ids.has(data.source) && ids.has(data.target) && data.source !== data.target
        ? [{ source: data.source, target: data.target, weight: data.weight ?? 1 }]
        : [],
    ),
  };
}

const memoryListSchema = z.object({ items: z.array(z.object({ id: z.string(), text: z.string(), fact_type: z.string() })) });

/** One entity, the memories that mention it and the entities mentioned with it. Null when the bank has no such entity. */
export async function entityDetail(bankId: string, entityId: string): Promise<EntityDetail | null> {
  const raw = await readBank(bankId, `/entities/${encodeURIComponent(entityId)}`);
  if (raw === null) return null;
  const entity = entityListSchema.shape.items.element.parse(raw);
  const [memories, all] = await Promise.all([
    readBank(bankId, "/memories/list", { entity_id: entityId, limit: 200 }).then((body) => memoryListSchema.parse(body)),
    listEntities(bankId),
  ]);
  const names = new Map(all.items.map((item) => [item.id, item.name]));
  const related = all.links
    .flatMap((link) => {
      const other = link.source === entityId ? link.target : link.target === entityId ? link.source : null;
      const name = other ? names.get(other) : undefined;
      return other && name ? [{ id: other, name, weight: link.weight }] : [];
    })
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
  return {
    id: entity.id,
    name: entity.canonical_name,
    mentions: entity.mention_count ?? 0,
    firstSeen: entity.first_seen,
    lastSeen: entity.last_seen,
    memories: memories.items.flatMap((item) =>
      isMemoryType(item.fact_type) ? [{ id: item.id, type: item.fact_type, text: item.text }] : [],
    ),
    related,
  };
}

const basedOnSchema = z
  .object({
    world: z.array(refSchema).nullish(),
    experience: z.array(refSchema).nullish(),
    observation: z.array(refSchema).nullish(),
    "mental-models": z.array(z.object({ id: z.string() })).nullish(),
  })
  .nullish();

const mentalModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  source_query: text,
  content: text,
  last_refreshed_at: date,
  last_refresh_failed_at: date,
  last_full_refreshed_at: date,
  created_at: date,
  is_stale: z.boolean().nullish(),
  trigger: z
    .object({ mode: z.string().nullish(), refresh_after_consolidation: z.boolean().nullish(), refresh_cron: text })
    .nullish(),
  reflect_response: z.object({ based_on: basedOnSchema }).nullish(),
});

type RawMentalModel = z.infer<typeof mentalModelSchema>;

/** The memories and models a mental model's content was built from. Model names come from `names`. */
function evidenceOf(model: RawMentalModel, names: Map<string, string>): MemoryRef[] {
  const basedOn = model.reflect_response?.based_on;
  if (!basedOn) return [];
  const memories = [...(basedOn.observation ?? []), ...(basedOn.world ?? []), ...(basedOn.experience ?? [])];
  const models = (basedOn["mental-models"] ?? []).flatMap(({ id }) =>
    id !== model.id && names.has(id) ? [{ id, type: "mental_model" as const, text: names.get(id) as string }] : [],
  );
  const seen = new Set<string>();
  return [...memories.flatMap((ref) => toRef(ref) ?? []), ...models].filter((ref) => {
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  });
}

function toMentalModel(model: RawMentalModel, names: Map<string, string>): MentalModelItem {
  return {
    id: model.id,
    name: model.name,
    sourceQuery: model.source_query,
    content: model.content ?? "",
    lastRefreshedAt: model.last_refreshed_at,
    refreshFailedAt: model.last_refresh_failed_at,
    stale: model.is_stale ?? false,
    evidence: evidenceOf(model, names),
  };
}

async function rawMentalModels(bankId: string): Promise<RawMentalModel[]> {
  const body = z
    .object({ items: z.array(mentalModelSchema) })
    .parse(await readBank(bankId, "/mental-models", { detail: "full", limit: 100 }));
  return body.items;
}

export async function listMentalModels(bankId: string): Promise<MentalModelItem[]> {
  const models = await rawMentalModels(bankId);
  const names = new Map(models.map((model) => [model.id, model.name]));
  return models.map((model) => toMentalModel(model, names));
}

const mentalModelHistorySchema = z.array(z.object({ changed_at: z.string(), previous_content: z.string().nullish() }));

/** One mental model with its configuration and earlier versions. Null when the bank has no such model. */
export async function mentalModelDetail(bankId: string, modelId: string): Promise<MentalModelDetail | null> {
  const path = `/mental-models/${encodeURIComponent(modelId)}`;
  const raw = await readBank(bankId, path, { detail: "full" });
  if (raw === null) return null;
  const model = mentalModelSchema.parse(raw);
  const [history, models] = await Promise.all([
    readBank(bankId, `${path}/history`).then((body) => mentalModelHistorySchema.parse(body ?? [])),
    rawMentalModels(bankId),
  ]);
  const names = new Map(models.map((item) => [item.id, item.name]));
  return {
    ...toMentalModel(model, names),
    createdAt: model.created_at,
    lastFullRefreshAt: model.last_full_refreshed_at,
    refreshMode: model.trigger?.mode ?? null,
    refreshAfterConsolidation: model.trigger?.refresh_after_consolidation ?? false,
    refreshCron: model.trigger?.refresh_cron ?? null,
    history: history
      .flatMap((change) =>
        change.previous_content ? [{ changedAt: change.changed_at, previousContent: change.previous_content }] : [],
      )
      .sort(newestFirst),
  };
}

function newestFirst(a: { changedAt: string }, b: { changedAt: string }): number {
  return Date.parse(b.changedAt) - Date.parse(a.changedAt);
}
