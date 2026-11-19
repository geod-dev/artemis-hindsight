import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { findStoreLink } from "@/server/products/store-link";

export const runtime = "nodejs";

const nameSchema = z.string().trim().min(1).max(200);

/**
 * GET /api/product-link?name=<product name>: `{ link }`, the store page of a product the agent named without a link,
 * found by a web search. 404 when none is found. Cookie or bearer.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const name = nameSchema.safeParse(new URL(request.url).searchParams.get("name"));
  if (!name.success) return Response.json({ error: "name is required" }, { status: 400 });

  const link = await findStoreLink(name.data);
  if (!link) return Response.json({ error: "no store found for this product" }, { status: 404 });
  return Response.json({ link }, { headers: { "cache-control": "private, max-age=86400" } });
}
