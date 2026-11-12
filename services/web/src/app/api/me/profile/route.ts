import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { updateOwnProfile, UserServiceError } from "@/server/users/users-service";

export const runtime = "nodejs";

export async function PATCH(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "display name and color are required" }, { status: 400 });
  }
  const { displayName, avatarColor } = body as Record<string, unknown>;

  try {
    const row = await updateOwnProfile(user.id, { displayName, avatarColor });
    return Response.json({ displayName: row.displayName, avatarColor: row.avatarColor });
  } catch (error) {
    if (error instanceof UserServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
