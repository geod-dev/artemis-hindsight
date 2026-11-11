import { adminForbidden, isAdminRequest } from "@/server/auth/admin";
import { deletePermanently, parseUsername, UserServiceError } from "@/server/users/users-service";

export const runtime = "nodejs";

/**
 * Permanently deletes an archived user and all their data. The body must repeat the username as confirmation:
 * { "confirm": "<username>" }
 */
export async function DELETE(req: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  if (!isAdminRequest(req)) return adminForbidden();

  try {
    const { username: raw } = await context.params;
    const username = parseUsername(raw);
    const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
    await deletePermanently(username, body?.confirm);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UserServiceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("failed to delete user", error);
    return Response.json({ error: "could not delete the user; the data that was left is still there, retry" }, { status: 502 });
  }
}
