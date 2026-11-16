import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { skillErrorResponse } from "@/server/skills/route-errors";
import { listInstalled } from "@/server/skills/skills-service";

export const runtime = "nodejs";

/** The signed-in user's skills. */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    return Response.json({ skills: await listInstalled(user.username) });
  } catch (error) {
    return skillErrorResponse(error, "list your skills");
  }
}
