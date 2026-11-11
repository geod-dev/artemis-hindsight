import { clearSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  await clearSessionCookie();
  return new Response(null, { status: 204 });
}
