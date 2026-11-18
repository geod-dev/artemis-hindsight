"use client";

import { Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DeveloperSettingsDialog } from "./developer-settings-dialog";

// The danger zone: bulk actions on the user's chats and memory. The same routes serve the mobile app.

export function DangerZoneSettings() {
  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Danger zone</h1>
        <p className="text-sm text-muted-foreground">
          Actions on all your chats and memory at once. Some of them cannot be undone.
        </p>
      </header>

      <section className="flex flex-col divide-y rounded-xl border bg-card">
        <DangerRow
          title="Archived chats"
          description="The chats you archived. Restore them to the list, or delete them for good."
        >
          <Button asChild variant="outline">
            <Link href="/settings/danger/archived">View archived</Link>
          </Button>
        </DangerRow>

        <ConfirmRow
          title="Archive all chats"
          description="Moves every chat out of the list. Nothing is deleted: they can be restored from archived chats."
          buttonLabel="Archive all"
          icon={Archive}
          confirmTitle="Archive all chats?"
          confirmDescription="Every chat leaves the list. You can restore them from archived chats."
          confirmLabel="Archive all"
          run={async () => {
            const body = (await request<{ archived: number }>("POST", "/api/conversations/archive-all")) ?? { archived: 0 };
            return `${body.archived} ${body.archived === 1 ? "chat" : "chats"} archived.`;
          }}
        />

        <ConfirmRow
          title="Delete all chats"
          description="Deletes every chat, archived or not, with its messages and files. Your memory is kept."
          buttonLabel="Delete all chats"
          icon={Trash2}
          destructive
          confirmTitle="Delete all chats?"
          confirmDescription="Every chat and its messages will be removed. Your memory stays. This cannot be undone."
          confirmLabel="Delete all chats"
          run={async () => {
            await request("POST", "/api/conversations/delete-all");
            return "All chats deleted.";
          }}
        />

        <ConfirmRow
          title="Delete all data"
          description="Deletes every chat and everything Artemis remembers about you. Your account and settings stay."
          buttonLabel="Delete all data"
          icon={Trash2}
          destructive
          confirmTitle="Delete all your data?"
          confirmDescription="Every chat and the whole memory will be erased. This cannot be undone."
          confirmLabel="Delete all data"
          run={async () => {
            await request("DELETE", "/api/me/data");
            return "All your data was deleted.";
          }}
        />

        <DangerRow
          title="Developer settings"
          description="Show the developer actions and settings"
        >
          <DeveloperSettingsDialog />
        </DangerRow>
      </section>
    </div>
  );
}

/** A non-interactive row: the explanation and a control on the right. */
function DangerRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** A row whose button asks for confirmation, runs the action, and shows what it did. */
function ConfirmRow({
  title,
  description,
  buttonLabel,
  icon: Icon,
  destructive = false,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  run,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  icon: typeof Archive;
  destructive?: boolean;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel: string;
  run: () => Promise<string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const message = await run();
      setResult(message);
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className={destructive ? "text-sm font-medium text-destructive" : "text-sm font-medium"}>{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (busy) return;
            setOpen(next);
            if (!next) setError(null);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="outline" className={destructive ? "text-destructive hover:text-destructive" : undefined}>
              <Icon />
              {buttonLabel}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className="text-sm text-destructive">Could not complete this: {error}.</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={destructive ? "destructive" : "default"}
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  void confirm();
                }}
              >
                {busy ? "Working…" : confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {result && <p className="text-sm text-muted-foreground">{result}</p>}
    </div>
  );
}

/**
 * Calls a route of the web app. Answers with the JSON body, or null for an empty answer. A failed call throws the
 * server's message.
 */
export async function request<T>(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}
