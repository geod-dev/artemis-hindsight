import { ArchivedChatsSettings } from "@/components/settings/archived-chats-settings";
import { getCurrentUser } from "@/server/auth/session";
import { listConversations } from "@/server/repositories/conversation-repository";
import { redirect } from "next/navigation";

// Reads the database on every request: the archived list changes as chats are archived and restored.
export const dynamic = "force-dynamic";

export default async function ArchivedChatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const rows = await listConversations(user.id, true);
  return (
    <ArchivedChatsSettings
      conversations={rows.map((row) => ({ id: row.id, title: row.title }))}
    />
  );
}
