import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { findProductImage } from "@/server/products/product-image";
import { findStoreLink } from "@/server/products/store-link";

export const runtime = "nodejs";

const querySchema = z.object({
  url: z.url({ protocol: /^https?$/ }).max(2048).optional(),
  name: z.string().trim().min(1).max(200),
});

/**
 * GET /api/product-image?url=<product page>&name=<product name>: the picture of a product in a reply's product group,
 * read from the product's page, or found by an image search on its name. Without url (the agent gave no link), the page
 * is the store page a web search finds for the product. Cookie or bearer.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const query = querySchema.safeParse({ url: params.get("url") ?? undefined, name: params.get("name") });
  if (!query.success) return Response.json({ error: "name is required, and url must be http or https" }, { status: 400 });

  const page = query.data.url ?? (await findStoreLink(query.data.name));
  const image = await findProductImage(page, query.data.name);
  if (!image) return Response.json({ error: "no picture found for this product" }, { status: 404 });
  return new Response(image.bytes, {
    headers: {
      "content-type": image.mediaType,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=86400",
    },
  });
}
