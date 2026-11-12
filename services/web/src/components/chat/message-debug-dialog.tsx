"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { MessageDebug } from "@/lib/message-debug";
import { CodeBlock } from "./code-block";
import { ToolEntry } from "./tool-entry";
import { buildSteps, type DebugPart, type DebugStep } from "./message-debug-steps";
import { formatDuration } from "./turn-timing-view";

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

export interface MessageDebugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  messageId: string;
}

/**
 * The debug view of one message: when it was stored and whether it reached memory, what a user message recalled
 * and what the model read, and for an assistant message the tree of its steps with their timings.
 * The data comes from the debug route, so a save that happened after the page loaded shows up on reopen.
 */
export function MessageDebugDialog({ open, onOpenChange, conversationId, messageId }: MessageDebugDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <MessageDebugBody conversationId={conversationId} messageId={messageId} />
      </DialogContent>
    </Dialog>
  );
}

type Loaded = { data: MessageDebug } | { error: string } | undefined;

/** Mounted only while the dialog is open, so each opening fetches the message again. */
function MessageDebugBody({ conversationId, messageId }: Omit<MessageDebugDialogProps, "open" | "onOpenChange">) {
  const [loaded, setLoaded] = useState<Loaded>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    const url = `/api/conversations/${conversationId}/messages/${encodeURIComponent(messageId)}/debug`;
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : `HTTP ${res.status}`;
          throw new Error(message);
        }
        setLoaded({ data: body as MessageDebug });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({ error: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [conversationId, messageId]);

  if (loaded === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <DebugHeader role="message" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if ("error" in loaded) {
    return (
      <div className="flex flex-col gap-3">
        <DebugHeader role="message" />
        <p className="text-destructive text-sm">
          Could not load the debug data: {loaded.error}. The message may not be saved yet.
        </p>
      </div>
    );
  }

  const message = loaded.data;
  return (
    <div className="flex flex-col gap-4">
      <DebugHeader role={message.role} createdAt={message.createdAt} />
      <Details message={message} />
      <Separator />
      {message.role === "user" ? (
        <>
          <RecalledMemories memory={message.memory} />
          <Separator />
          <ModelInput modelInput={message.modelInput} />
        </>
      ) : (
        <StepTree message={message} />
      )}
    </div>
  );
}

function DebugHeader({ role, createdAt }: { role: string; createdAt?: string }) {
  return (
    <DialogHeader>
      <DialogTitle>Message debug</DialogTitle>
      <DialogDescription>
        {role === "user" ? "User message" : role === "assistant" ? "Assistant message" : "Message"}
        {createdAt ? ` · ${dateTime.format(new Date(createdAt))}` : ""}
      </DialogDescription>
    </DialogHeader>
  );
}

function Details({ message }: { message: MessageDebug }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Message ID</dt>
      <dd className="font-mono text-xs break-all">{message.id}</dd>

      <dt className="text-muted-foreground">Stored</dt>
      <dd>{dateTime.format(new Date(message.createdAt))}</dd>

      <dt className="text-muted-foreground">Status</dt>
      <dd>
        <Badge variant="secondary">{message.status}</Badge>
      </dd>

      {message.model && (
        <>
          <dt className="text-muted-foreground">Model</dt>
          <dd className="font-mono text-xs">{message.model}</dd>
        </>
      )}

      <dt className="text-muted-foreground">Memory</dt>
      <dd className="flex flex-col gap-1">
        {message.memorizedAt ? (
          <>
            <Badge>Saved</Badge>
            <span className="text-muted-foreground">Saved to memory {dateTime.format(new Date(message.memorizedAt))}.</span>
          </>
        ) : (
          <>
            <Badge variant="outline">Not saved yet</Badge>
            <span className="text-muted-foreground">
              {message.conversationActive
                ? "This conversation is still active. It is saved to memory when another conversation receives a message, or after an hour without a new message."
                : "This conversation is no longer active, yet the message is not saved. The save may have failed; the server log has the reason."}
            </span>
          </>
        )}
      </dd>
    </dl>
  );
}

function RecalledMemories({ memory }: { memory: MessageDebug["memory"] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Recalled memories</h3>
      {memory === undefined ? (
        <p className="text-muted-foreground text-sm">Not recorded for this message.</p>
      ) : memory.status === "unavailable" ? (
        <p className="text-destructive text-sm">
          Memory lookup failed{memory.durationMs !== undefined ? ` after ${memory.durationMs} ms` : ""}:{" "}
          {memory.reason ?? "unknown reason"}.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Query <span className="text-foreground font-mono text-xs">{memory.query}</span> · budget{" "}
            <Badge variant="outline">{memory.budget}</Badge>
            {memory.durationMs !== undefined && (
              <>
                {" "}· recall took <span className="text-foreground font-mono text-xs">{memory.durationMs} ms</span>
              </>
            )}
          </p>
          {memory.facts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No memories matched this message.</p>
          ) : (
            <Table>
              <TableBody>
                {memory.facts.map((fact, index) => (
                  <TableRow key={fact.id ?? index}>
                    <TableCell className="w-28 align-top">
                      {fact.type ? <Badge variant="secondary">{fact.type}</Badge> : null}
                    </TableCell>
                    <TableCell className="whitespace-normal">{fact.text}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </section>
  );
}

function ModelInput({ modelInput }: { modelInput: MessageDebug["modelInput"] }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Message sent to the model</h3>
        {modelInput && (
          <Button variant="ghost" size="xs" onClick={() => copyToClipboard(modelInput.text)}>
            {isCopied ? <CheckIcon /> : <CopyIcon />}
            {isCopied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>
      {modelInput === undefined ? (
        <p className="text-muted-foreground text-sm">Not recorded for this message.</p>
      ) : (
        <>
          {modelInput.files.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {modelInput.files.map((file, index) => (
                <Badge key={index} variant="outline">
                  {file.filename ?? "file"} · {file.mediaType}
                </Badge>
              ))}
            </div>
          )}
          <CodeBlock code={modelInput.text} language="text" />
        </>
      )}
    </section>
  );
}

function StepTree({ message }: { message: MessageDebug }) {
  const timing = message.turnTiming;
  const steps = buildSteps(message.parts, timing);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Steps</h3>
        {timing && (
          <span className="text-muted-foreground text-xs">
            Turn {timing.endedAt !== undefined ? formatDuration(timing.endedAt - timing.startedAt) : "running"}
          </span>
        )}
      </div>
      {steps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No steps recorded.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {steps.map((step) => (
            <StepNode key={step.number} step={step} turnStart={timing?.startedAt} />
          ))}
        </ol>
      )}
    </section>
  );
}

function StepNode({ step, turnStart }: { step: DebugStep; turnStart: number | undefined }) {
  const offset = step.startedAt !== undefined && turnStart !== undefined ? formatDuration(step.startedAt - turnStart) : undefined;
  const duration = step.startedAt !== undefined && step.endedAt !== undefined ? formatDuration(step.endedAt - step.startedAt) : undefined;
  const firstText =
    step.firstTextAt !== undefined && turnStart !== undefined ? formatDuration(step.firstTextAt - turnStart) : undefined;

  return (
    <li className="border-muted-foreground/30 flex flex-col gap-2 border-l pl-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Step {step.number}</span>
        {offset && <span className="text-muted-foreground font-mono text-xs">+{offset}</span>}
        {duration && <span className="text-muted-foreground text-xs">{duration}</span>}
        {step.finishReason && <Badge variant="outline">{step.finishReason}</Badge>}
        {firstText && <span className="text-muted-foreground text-xs">first text +{firstText}</span>}
      </div>
      {step.parts.length === 0 ? (
        <p className="text-muted-foreground text-xs">No content.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {step.parts.map((part, index) => (
            <li key={index}>
              <StepPart part={part} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function StepPart({ part }: { part: DebugPart }): ReactNode {
  if (part.kind === "reasoning") {
    const duration =
      part.startedAt !== undefined && part.endedAt !== undefined ? formatDuration(part.endedAt - part.startedAt) : undefined;
    return <p className="text-muted-foreground text-xs">Thinking{duration ? ` · ${duration}` : ""}</p>;
  }
  if (part.kind === "tool") {
    const failed = part.state === "output-error";
    const running = part.state === "input-streaming" || part.state === "input-available";
    return (
      <ToolEntry
        label={part.name}
        request={safeStringify(part.input)}
        result={part.errorText ?? safeStringify(part.output)}
        running={running}
        failed={failed}
      />
    );
  }
  if (part.kind === "text") {
    const preview = part.text.length > 160 ? `${part.text.slice(0, 157)}...` : part.text;
    return (
      <p className="text-muted-foreground text-xs">
        Text · {part.text.length} characters · <span className="font-mono">{preview}</span>
      </p>
    );
  }
  return <Badge variant="outline">{part.type}</Badge>;
}

function safeStringify(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
