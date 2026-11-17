import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { projectIcon, ProjectServiceError } from "@/server/projects/project-service";

export const runtime = "nodejs";

/** A project's icon image. 404 when the project has none. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid project id" }, { status: 400 });

  try {
    const icon = await projectIcon(user, id);
    if (!icon) return Response.json({ error: "no such icon" }, { status: 404 });
    return new Response(icon.bytes, {
      headers: {
        "content-type": icon.mediaType,
        "content-length": String(icon.bytes.byteLength),
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-cache",
      },
    });
  } catch (error) {
    if (error instanceof ProjectServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
