import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { skillErrorResponse } from "@/server/skills/route-errors";
import { browseSource } from "@/server/skills/skills-service";

export const runtime = "nodejs";

/** The skills in a marketplace: GET /api/skills/marketplace?repo=owner/repo[&refresh=1] */
export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const params = new URL(req.url).searchParams;
  try {
    return Response.json({ skills: await browseSource(params.get("repo"), params.get("refresh") === "1") });
  } catch (error) {
    return skillErrorResponse(error, "list the marketplace");
  }
}
