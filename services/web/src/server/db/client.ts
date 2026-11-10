import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getConfig } from "../config";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

// Cache on globalThis so Next.js dev hot reloads do not open new pools.
const globalForDb = globalThis as unknown as { __artemisDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__artemisDb) {
    const sql = postgres(getConfig().DATABASE_URL, { max: 10 });
    globalForDb.__artemisDb = drizzle(sql, { schema });
  }
  return globalForDb.__artemisDb;
}
