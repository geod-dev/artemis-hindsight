import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ConversationTitlesProvider } from "@/components/conversation-titles";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ProfileSetupScreen } from "@/components/profile/profile-setup-screen";
import { getCurrentUser } from "@/server/auth/session";
import { conversationJson } from "@/server/conversations/conversation-json";
import { listConversations } from "@/server/repositories/conversation-repository";
import { listProjects } from "@/server/repositories/project-repository";
import { projectJson } from "@/server/projects/project-service";
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

  const [conversations, projects] = await Promise.all([listConversations(user.id), listProjects(user.id)]);

  return (
    <ConversationTitlesProvider>
      <SidebarProvider>
        <AppSidebar
          username={user.username}
          displayName={user.displayName}
          avatarColor={user.avatarColor}
          projects={projects.map(projectJson)}
          conversations={conversations.map(conversationJson)}
        />
        <SidebarInset className="h-svh min-h-0 overflow-hidden">{children}</SidebarInset>
      </SidebarProvider>
    </ConversationTitlesProvider>
  );
}
