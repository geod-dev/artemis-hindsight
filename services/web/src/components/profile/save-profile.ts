import type { AvatarColorId } from "@/lib/avatar-colors";

export interface ProfileValues {
  displayName: string;
  avatarColor: AvatarColorId;
}

/** Saves the signed-in user's profile. Throws with the server's message when it is refused. */
export async function saveProfile(values: ProfileValues): Promise<void> {
  const res = await fetch("/api/me/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : "";
    throw new Error(message || `could not save the profile (HTTP ${res.status})`);
  }
}
