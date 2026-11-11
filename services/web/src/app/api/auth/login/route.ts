import { z } from "zod";
import { authenticate } from "@/server/users/users-service";
import { issueSessionToken, setSessionCookie, type CurrentUser } from "@/server/auth/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

/** Checks the username and password and starts a 30-day session in an httpOnly cookie. */
export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "username and password are required" }, { status: 400 });

  const row = await authenticate(parsed.data.username, parsed.data.password);
  if (!row) return Response.json({ error: "wrong username or password" }, { status: 401 });
  if (row.status !== "active") return Response.json({ error: "this account is archived" }, { status: 403 });

  const user: CurrentUser = { id: row.id, username: row.username };
  await setSessionCookie(await issueSessionToken(user), new URL(req.url).protocol === "https:");
  return Response.json({ username: user.username });
}
