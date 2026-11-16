import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { skillErrorResponse } from "@/server/skills/route-errors";
import { installFromMarketplace } from "@/server/skills/skills-service";

export const runtime = "nodejs";

/** Installs a marketplace skill into the signed-in user's skills. Body: { "repo": "owner/repo", "path": "skills/pdf" } */
export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { repo?: unknown; path?: unknown } | null;
  try {
    return Response.json(await installFromMarketplace(user.username, body?.repo, body?.path));
  } catch (error) {
    return skillErrorResponse(error, "install the skill");
  }
}
