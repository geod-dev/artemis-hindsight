import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { deleteProject, projectJson, ProjectServiceError, updateProject } from "@/server/projects/project-service";

export const runtime = "nodejs";

/**
 * Changes a project from a multipart form. A field left out keeps its value. `icon` (an image) replaces the icon,
 * `removeIcon=true` drops it.
 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid project id" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "expected a form with the project's fields" }, { status: 400 });

  try {
    return Response.json(projectJson(await updateProject(user, id, form)));
  } catch (error) {
    if (error instanceof ProjectServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

/** Deletes a project and its folder. Its conversations stay, outside any project. */
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid project id" }, { status: 400 });

  try {
    await deleteProject(user, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
