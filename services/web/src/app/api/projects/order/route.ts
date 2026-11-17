import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { ProjectServiceError, reorderProjects } from "@/server/projects/project-service";

export const runtime = "nodejs";

const orderBody = z.object({ ids: z.array(z.uuid()).min(1).max(500) });

/**
 * Sets the order of the user's projects: `{ "ids": [...] }` lists every project id, in the order they should show.
 */
export async function PUT(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = orderBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "ids must list project ids" }, { status: 400 });

  try {
    await reorderProjects(user, body.data.ids);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
