import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

export const runtime = "nodejs";
// Never prerendered at build time: each probe must check the database when it runs.
export const dynamic = "force-dynamic";

/**
 * Healthcheck for Docker and Coolify. 200 when the app can reach its database (and its configuration loads),
 * 503 otherwise. Public on purpose: it answers no user data.
 */
export async function GET(): Promise<Response> {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
