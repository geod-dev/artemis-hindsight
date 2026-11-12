import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ConversationTitlesProvider } from "@/components/conversation-titles";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ProfileSetupScreen } from "@/components/profile/profile-setup-screen";
import { getCurrentUser } from "@/server/auth/session";
import { listConversations } from "@/server/repositories/conversation-repository";
import { isProfileComplete } from "@/lib/profile";

// Reads the database and the session on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

/** The chat shell. Everything in it is private to the signed-in user. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  const conversations = await listConversations(user.id);

  return (
    <ConversationTitlesProvider>
      <SidebarProvider>
        <AppSidebar
          username={user.username}
          displayName={user.displayName}
          avatarColor={user.avatarColor}
          conversations={conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }))}
        />
        <SidebarInset className="h-svh min-h-0 overflow-hidden">{children}</SidebarInset>
      </SidebarProvider>
    </ConversationTitlesProvider>
  );
}
