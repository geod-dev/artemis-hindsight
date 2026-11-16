import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { skillErrorResponse } from "@/server/skills/route-errors";
import { addSource, listSources, removeSource } from "@/server/skills/skills-service";

export const runtime = "nodejs";

/** The marketplaces: the built-in ones and those the signed-in user added. */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    return Response.json({ sources: await listSources(user.id) });
  } catch (error) {
    return skillErrorResponse(error, "list the marketplaces");
  }
}

/** Adds a marketplace. Body: { "repo": "owner/repo" or a GitHub URL } */
export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { repo?: unknown } | null;
  try {
    return Response.json(await addSource(user.id, body?.repo));
  } catch (error) {
    return skillErrorResponse(error, "add the marketplace");
  }
}

/** Removes a marketplace the user added: DELETE /api/skills/sources?repo=owner/repo */
export async function DELETE(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    await removeSource(user.id, new URL(req.url).searchParams.get("repo"));
    return new Response(null, { status: 204 });
  } catch (error) {
    return skillErrorResponse(error, "remove the marketplace");
  }
}
