"use client";

import { Code, Loader2, Save, Sparkles, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMessageDebugPreference } from "@/lib/developer-prefs";
import { cn } from "@/lib/utils";
import { request } from "./danger-zone-settings";

// Developer settings, opened from the danger zone. Web only: the phone has no debug view of messages.

/** The "Open developer settings" button and its dialog. */
export function DeveloperSettingsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Code />
          Open developer settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Developer settings</DialogTitle>
          <DialogDescription>Tools for looking inside Artemis. The toggle applies to this browser only.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y rounded-xl border">
          <MessageDebugRow />
          <FlushRow />
          <ConsolidateRow />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ title, description, htmlFor, children }: { title: string; description: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {title}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function MessageDebugRow() {
  const id = useId();
  const [show, setShow] = useMessageDebugPreference();
  return (
    <Row
      title="Show debug option in messages"
      description="Adds a menu under each message to see what the model received, the recalled memory and the timings."
      htmlFor={id}
    >
      <Switch id={id} checked={show} onCheckedChange={setShow} />
    </Row>
  );
}

function FlushRow() {
  return (
    <ActionRow
      title="Save conversations to memory"
      description="Sends every conversation with unsaved messages to memory now, without waiting for a switch or an hour of silence."
      icon={Save}
      buttonLabel="Save now"
      run={async () => {
        const count = (await request<{ conversations: number }>("POST", "/api/memory/flush"))?.conversations ?? 0;
        return count === 0
          ? "Every conversation is already in memory."
          : `${count} ${count === 1 ? "conversation" : "conversations"} sent. Memory extracts the facts in the background.`;
      }}
    />
  );
}

function ConsolidateRow() {
  return (
    <ActionRow
      title="Consolidate memory now"
      description="Turns the new memories into observations and refreshes the summaries, without waiting for the daily run at 5 AM."
      icon={Sparkles}
      buttonLabel="Run now"
      run={async () => {
        const pending = (await request<{ pending: number }>("POST", "/api/memory/consolidate"))?.pending ?? 0;
        return pending === 0
          ? "Nothing new to consolidate."
          : `Consolidating ${pending} ${pending === 1 ? "memory" : "memories"}. It runs in the background, then the memory summaries refresh.`;
      }}
    />
  );
}

/** A row whose button runs an action on the server and shows what it did, or why it failed. */
function ActionRow({
  title,
  description,
  icon: Icon,
  buttonLabel,
  run,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  buttonLabel: string;
  run: () => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function start() {
    setBusy(true);
    setResult(null);
    try {
      setResult({ ok: true, text: await run() });
    } catch (cause) {
      setResult({ ok: false, text: `Could not complete this: ${cause instanceof Error ? cause.message : String(cause)}.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <Row title={title} description={description}>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void start()}>
          {busy ? <Loader2 className="animate-spin" /> : <Icon />}
          {buttonLabel}
        </Button>
      </Row>
      {result && (
        <p className={cn("px-4 pb-4 text-sm", result.ok ? "text-muted-foreground" : "text-destructive")}>{result.text}</p>
      )}
    </div>
  );
}
