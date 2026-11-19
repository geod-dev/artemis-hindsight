import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { IMAGE_RESULT_COUNT, ImageSearchUnavailableError, searchImageGroup } from "@/server/clients/brave-client";

export const runtime = "nodejs";

const MAX_QUERY_LENGTH = 200;
const MAX_QUERIES = 8;

/**
 * GET /api/image-search?q=<query>&q=<query>…&n=<per query>[&r=<w>:<h>]: the images of an image group in a reply.
 * With `r`, the group's tile shape, each image is the result that best fits it among the query's next few.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const queries = params.getAll("q").map((query) => query.trim());
  const perQuery = Number(params.get("n") ?? "1");
  if (!Number.isInteger(perQuery) || perQuery < 1 || perQuery > IMAGE_RESULT_COUNT) {
    return Response.json({ error: `n must be 1 to ${IMAGE_RESULT_COUNT}` }, { status: 400 });
  }
  if (queries.length === 0 || queries.length > MAX_QUERIES) {
    return Response.json({ error: `an image group has 1 to ${MAX_QUERIES} queries` }, { status: 400 });
  }
  if (queries.some((query) => query === "" || query.length > MAX_QUERY_LENGTH)) {
    return Response.json({ error: `each query must be 1 to ${MAX_QUERY_LENGTH} characters` }, { status: 400 });
  }

  const shape = params.get("r");
  const match = shape === null ? null : /^(\d{1,3}):(\d{1,3})$/.exec(shape);
  if (shape !== null && (!match || Number(match[1]) === 0 || Number(match[2]) === 0)) {
    return Response.json({ error: "r must be a ratio such as 16:9" }, { status: 400 });
  }
  const ratio = match ? Number(match[1]) / Number(match[2]) : undefined;

  try {
    const results = await searchImageGroup(queries, perQuery, ratio);
    // Not cached by the browser: an answer may lack a query that failed, and a reload should try it again. The
    // queries that succeeded are read from the database, so a reload costs no Brave call for them.
    return Response.json({ results }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ImageSearchUnavailableError) {
      return Response.json({ error: "image search is not configured" }, { status: 503 });
    }
    console.warn("image search unavailable", { reason: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "image search is unavailable right now" }, { status: 502 });
  }
}
