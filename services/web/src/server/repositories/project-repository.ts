import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { projects } from "../db/schema";
import { announceListChange } from "../events/list-events";

export type ProjectRow = typeof projects.$inferSelect;

export interface NewProject {
  id: string;
  userId: string;
  name: string;
  color: string;
  iconFile: string | null;
  description: string | null;
}

// Every function here takes the owner's id. A project is only ever read or changed by the user who owns it.

/** The user's projects, in their order: the position they were given, then by name for projects never moved. */
export async function listProjects(userId: string): Promise<ProjectRow[]> {
  return getDb()
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.position), asc(sql`lower(${projects.name})`), asc(projects.id));
}

/**
 * Gives the user's projects their order: the first id is at position 0. `ids` must be every project of the user, once
 * each; the caller checks that. Written in one transaction, so the list is never half-reordered.
 */
export async function setProjectOrder(userId: string, ids: string[]): Promise<void> {
  await getDb().transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(projects)
        .set({ position })
        .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    }
  });
  announceListChange(userId);
}

export async function findProject(id: string, userId: string): Promise<ProjectRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  return row;
}

/** Stores a new project at the end of the user's list. */
export async function insertProject(values: NewProject): Promise<ProjectRow> {
  const [row] = await getDb()
    .insert(projects)
    .values({
      ...values,
      position: sql`(select coalesce(max(${projects.position}), -1) + 1 from ${projects} where ${projects.userId} = ${values.userId})`,
    })
    .returning();
  if (!row) throw new Error("the project was not stored");
  announceListChange(values.userId);
  return row;
}

/** Changes the given fields of the user's project. Returns the project, or undefined when it is not theirs. */
export async function updateProject(
  id: string,
  userId: string,
  values: Partial<Pick<NewProject, "name" | "color" | "iconFile" | "description">>,
): Promise<ProjectRow | undefined> {
  const [row] = await getDb()
    .update(projects)
    .set({ ...values, updatedAt: sql`now()` })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  if (row) announceListChange(userId);
  return row;
}

/** Deletes the user's project. Its conversations stay, with no project. Returns false when it is not theirs. */
export async function deleteProject(id: string, userId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  if (deleted.length > 0) announceListChange(userId);
  return deleted.length > 0;
}
