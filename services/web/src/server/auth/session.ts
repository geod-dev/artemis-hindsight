import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getConfig } from "../config";
import { getDb } from "../db/client";
import { users } from "../db/schema";

// A login is a signed JWT (HS256) in an httpOnly cookie, valid for 30 days.
// Every request also checks the user row, so archiving or deleting a user signs them out at once.

export const SESSION_COOKIE = "artemis_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface CurrentUser {
  id: string;
  username: string;
}

function signingKey(): Uint8Array {
  return new TextEncoder().encode(getConfig().AUTH_SECRET);
}

export function issueSessionToken(user: CurrentUser): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

/** The signed-in user of the current request, or null. Archived and deleted users are not signed in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    userId = payload.sub;
  } catch {
    return null;
  }
  if (!userId) return null;

  const [row] = await getDb()
    .select({ id: users.id, username: users.username, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || row.status !== "active") return null;
  return { id: row.id, username: row.username };
}

export async function setSessionCookie(token: string, secure: boolean): Promise<void> {
  (await cookies()).set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/" });
}

export function unauthorized(): Response {
  return Response.json({ error: "sign in first" }, { status: 401 });
}
