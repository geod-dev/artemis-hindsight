import { adminForbidden, isAdminRequest } from "@/server/auth/admin";
import { parseUsername, resetPassword, UserServiceError } from "@/server/users/users-service";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  if (!isAdminRequest(req)) return adminForbidden();

  try {
    const { username: raw } = await context.params;
    const username = parseUsername(raw);
    const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
    await resetPassword(username, body?.password);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UserServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
