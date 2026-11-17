"use client";

import { ArchiveRestore, ArrowLeft, Trash2 } from "lucide-react";
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
    <div className="flex flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="w-fit justify-start gap-2 px-0 text-muted-foreground hover:text-foreground">
          <Link href="/settings/danger">
            <ArrowLeft className="size-4" />
            Danger zone
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Archived chats</h1>
        <p className="text-sm text-muted-foreground">
          Chats left out of the list. Restore one to bring it back, or delete it for good.
        </p>
      </header>

      {error && <p className="text-sm text-destructive">Could not complete this: {error}.</p>}

      {conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No archived chats.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {conversations.map((conversation) => {
            const busy = busyId === conversation.id;
            return (
              <li key={conversation.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Link href={`/c/${conversation.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {conversation.title}
                </Link>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void restore(conversation)}>
                    <ArchiveRestore />
                    Restore
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(conversation)}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
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
    </div>
  );
}
