import { ProfileSettings } from "@/components/settings/profile-settings";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <ProfileSettings
      username={user.username}
      savedDisplayName={user.displayName ?? ""}
      savedColor={user.avatarColor}
    />
  );
}
