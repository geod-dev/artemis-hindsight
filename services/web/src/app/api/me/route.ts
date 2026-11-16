import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { isProfileComplete } from "@/lib/profile";

export const runtime = "nodejs";

/** The signed-in user. Native clients call it at start-up to check that their token still works. */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    profileComplete: isProfileComplete(user),
  });
}
