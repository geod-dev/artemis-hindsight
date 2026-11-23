import { DEFAULT_USAGE_RANGE, isUsageRange } from "@/lib/usage";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { usageForUser } from "@/server/usage/usage-service";

export const runtime = "nodejs";

/** The signed-in user's token usage and cost for a period: `?range=this-month|7d|30d|this-year|all`. */
export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const requested = new URL(req.url).searchParams.get("range");
  const range = isUsageRange(requested) ? requested : DEFAULT_USAGE_RANGE;
  return Response.json(await usageForUser(user, range, new Date()));
}
