// Runs database migrations. Executed by the one-shot `migrate` container before the web app starts.
// Wrapped in main() so it also runs when tsx compiles it as CommonJS (apps/web is not an ESM package).
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle");
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await migrate(drizzle(sql), { migrationsFolder });
    console.log(`migrations applied from ${migrationsFolder}`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
