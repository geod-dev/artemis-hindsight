import { redirect } from "next/navigation";
import { ProfileSetupScreen } from "@/components/profile/profile-setup-screen";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { isProfileComplete } from "@/lib/profile";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!isProfileComplete(user)) {
    return (
      <ProfileSetupScreen
        username={user.username}
        initialDisplayName={user.displayName}
        initialColor={user.avatarColor}
      />
    );
  }

  return (
    <div className="flex h-svh min-h-0 bg-background">
      <SettingsSidebar />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
