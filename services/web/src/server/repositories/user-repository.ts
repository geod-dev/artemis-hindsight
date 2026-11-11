import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { users, type UserStatus } from "../db/schema";

export type UserRow = typeof users.$inferSelect;

export async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  const [row] = await getDb().select().from(users).where(eq(users.username, username)).limit(1);
  return row;
}

export async function listUsers(): Promise<UserRow[]> {
  return getDb().select().from(users).orderBy(asc(users.username));
}

/** Inserts the user. Returns null when the username is already taken. */
export async function insertUser(username: string, passwordHash: string): Promise<UserRow | null> {
  const [row] = await getDb()
    .insert(users)
    .values({ username, passwordHash })
    .onConflictDoNothing({ target: users.username })
    .returning();
  return row ?? null;
}

export async function updatePasswordHash(username: string, passwordHash: string): Promise<boolean> {
  const updated = await getDb()
    .update(users)
    .set({ passwordHash, updatedAt: sql`now()` })
    .where(eq(users.username, username))
    .returning({ id: users.id });
  return updated.length > 0;
}

export async function updateStatus(username: string, status: UserStatus): Promise<boolean> {
  const updated = await getDb()
    .update(users)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(users.username, username))
    .returning({ id: users.id });
  return updated.length > 0;
}

/** Deletes the user. Their conversations and messages go with them (cascade). */
export async function deleteUserRow(username: string): Promise<boolean> {
  const deleted = await getDb().delete(users).where(eq(users.username, username)).returning({ id: users.id });
  return deleted.length > 0;
}
