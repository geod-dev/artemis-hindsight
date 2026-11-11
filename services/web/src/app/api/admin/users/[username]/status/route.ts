import { adminForbidden, isAdminRequest } from "@/server/auth/admin";
import { parseUsername, setArchived, UserServiceError } from "@/server/users/users-service";

export const runtime = "nodejs";

/** Archives ({ "archived": true }) or restores ({ "archived": false }) a user. */
export async function POST(req: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  if (!isAdminRequest(req)) return adminForbidden();

  try {
    const { username: raw } = await context.params;
    const username = parseUsername(raw);
    const body = (await req.json().catch(() => null)) as { archived?: unknown } | null;
    if (typeof body?.archived !== "boolean") {
      return Response.json({ error: "archived must be true or false" }, { status: 400 });
    }
    await setArchived(username, body.archived);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UserServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
