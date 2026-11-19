"use client";

import { ArchiveRestore, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "@/components/settings/danger-zone-settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SettingsList, SettingsPage, SettingsRow } from "./settings-page";

export interface ArchivedConversation {
  id: string;
  title: string;
}

/** The archived chats: each can be restored to the list or deleted for good. */
export function ArchivedChatsSettings({ conversations }: { conversations: ArchivedConversation[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<ArchivedConversation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(conversation: ArchivedConversation) {
    setBusyId(conversation.id);
    setError(null);
    try {
      await request("PATCH", `/api/conversations/${conversation.id}`, { archived: false });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteChat(conversation: ArchivedConversation) {
    setBusyId(conversation.id);
    setError(null);
    try {
      await request("DELETE", `/api/conversations/${conversation.id}`);
      setPendingDelete(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SettingsPage
      title="Archived chats"
      description="Chats left out of the list. Restore one to bring it back, or delete it for good."
      back={{ href: "/settings/danger", label: "Danger zone" }}
    >
      {error && <p className="text-sm text-destructive">Could not complete this: {error}.</p>}

      {conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No archived chats.</p>
      ) : (
        <SettingsList>
          {conversations.map((conversation) => {
            const busy = busyId === conversation.id;
            return (
              <SettingsRow
                key={conversation.id}
                title={
                  <Link href={`/c/${conversation.id}`} className="hover:underline">
                    {conversation.title}
                  </Link>
                }
                actions={
                  <>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void restore(conversation)}>
                      <ArchiveRestore />
                      Restore
                    </Button>
                    <Button
                      variant="outline-destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => setPendingDelete(conversation)}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </>
                }
              />
            );
          })}
        </SettingsList>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title ?? ""}” and all of its messages will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busyId !== null}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) void deleteChat(pendingDelete);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPage>
  );
}
