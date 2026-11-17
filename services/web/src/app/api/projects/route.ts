import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { listProjects } from "@/server/repositories/project-repository";
import { createProject, projectJson, ProjectServiceError } from "@/server/projects/project-service";

export const runtime = "nodejs";

/** The signed-in user's projects, by name. */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await listProjects(user.id);
  return Response.json({ projects: rows.map(projectJson) });
}

/**
 * Creates a project from a multipart form: name, color, description (optional) and icon (optional image).
 */
export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "expected a form with the project's fields" }, { status: 400 });

  try {
    return Response.json(projectJson(await createProject(user, form)), { status: 201 });
  } catch (error) {
    if (error instanceof ProjectServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
