import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { skillErrorResponse } from "@/server/skills/route-errors";
import { uninstall } from "@/server/skills/skills-service";

export const runtime = "nodejs";

/** Removes one of the signed-in user's skills: its whole folder. */
export async function DELETE(_req: Request, context: { params: Promise<{ folder: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { folder } = await context.params;
    await uninstall(user.username, folder);
    return new Response(null, { status: 204 });
  } catch (error) {
    return skillErrorResponse(error, "remove the skill");
  }
}
