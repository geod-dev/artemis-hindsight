"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useConversationTitles } from "@/components/conversation-titles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// The phone's copy is apps/mobile/src/components/rename-conversation-sheet.tsx: same two choices, same routes.

/** Same limit as the server (PATCH /api/conversations/[id]). */
const TITLE_MAX = 120;

/**
 * Renames a conversation: type a name, or let the naming task name it again from the whole conversation. Pass the
 * conversation to open it, null to close it.
 */
export function RenameConversationDialog({
  conversation,
  onClose,
}: {
  conversation: { id: string; title: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={conversation !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {conversation && <RenameForm key={conversation.id} conversation={conversation} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ conversation, onClose }: { conversation: { id: string; title: string }; onClose: () => void }) {
  const router = useRouter();
  const { setTitle } = useConversationTitles();
  const [title, setTitleInput] = useState(conversation.title);
  const [busy, setBusy] = useState<"save" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Shows the new name everywhere at once (sidebar, heading), then reads the lists again. */
  function applied(next: string) {
    setTitle(conversation.id, next);
    router.refresh();
    onClose();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (!next) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      applied(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/title`, { method: "POST" });
      if (!res.ok) throw new Error(await errorOf(res));
      applied(((await res.json()) as { title: string }).title);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Rename conversation</DialogTitle>
        <DialogDescription>Type a name, or generate one from the whole conversation.</DialogDescription>
      </DialogHeader>

      <Input
        aria-label="Name"
        placeholder="Name"
        maxLength={TITLE_MAX}
        value={title}
        onChange={(event) => setTitleInput(event.target.value)}
        disabled={busy !== null}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="outline" onClick={() => void generate()} disabled={busy !== null}>
          {busy === "generate" ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Generate
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy !== null}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy !== null || !title.trim()}>
            {busy === "save" ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

async function errorOf(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `HTTP ${res.status}`;
}
