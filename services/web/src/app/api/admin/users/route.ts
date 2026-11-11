import { adminForbidden, isAdminRequest } from "@/server/auth/admin";
import { listUsers } from "@/server/repositories/user-repository";
import { createAccount, UserServiceError } from "@/server/users/users-service";
import { z } from "zod";

export const runtime = "nodejs";

function publicUser(row: Awaited<ReturnType<typeof listUsers>>[number]) {
  return {
    username: row.username,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: Request): Promise<Response> {
  if (!isAdminRequest(req)) return adminForbidden();
  return Response.json({ users: (await listUsers()).map(publicUser) });
}

const createSchema = z.object({ username: z.unknown(), password: z.unknown() });

export async function POST(req: Request): Promise<Response> {
  if (!isAdminRequest(req)) return adminForbidden();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "username and password are required" }, { status: 400 });

  try {
    const row = await createAccount(parsed.data.username, parsed.data.password);
    return Response.json({ user: publicUser(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof UserServiceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("failed to create user", error);
    return Response.json({ error: "could not create the user; see the server log" }, { status: 502 });
  }
}
