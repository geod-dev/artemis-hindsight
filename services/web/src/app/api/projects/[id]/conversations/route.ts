import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { projectConversations, ProjectServiceError } from "@/server/projects/project-service";

export const runtime = "nodejs";

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(4),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

/**
 * One page of a project's conversations, most recent first, with the total. The web "see more" control asks for
 * more of them each time; the mobile list pages through them with offset.
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid project id" }, { status: 400 });

  const page = pageSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!page.success) return Response.json({ error: "limit and offset must be whole numbers" }, { status: 400 });

  try {
    return Response.json(await projectConversations(user, id, page.data.limit, page.data.offset));
  } catch (error) {
    if (error instanceof ProjectServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
