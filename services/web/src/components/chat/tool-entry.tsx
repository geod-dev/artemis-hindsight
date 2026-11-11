"use client";

import { CheckIcon, ChevronRightIcon, FileTextIcon, LoaderCircleIcon, PencilIcon, XIcon } from "lucide-react";
import { Collapsible } from "radix-ui";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ToolEntryProps {
  /** Short description of what the tool call does, shown in the row. */
  label: string;
  /** What was sent to the tool (the command, for bash). Shown when the row is expanded. */
  request: string;
  /** What the tool returned. Shown when the row is expanded. */
  result: string;
  running: boolean;
  failed: boolean;
  /** The icon shown when the call is done: a check by default, a pencil or a file for file calls. */
  doneIcon?: "check" | "pencil" | "file";
  /** Replaces doneIcon when set, for example a magnifier or a page favicon. */
  icon?: ReactNode;
  /** Replaces the request and result when set, for example a code diff of a file change. */
  details?: ReactNode;
}

/**
 * One tool call inside a run: a status icon and its label, expanding to the request and result.
 * Owned by this project, so it can change freely without touching the downloaded assistant-ui elements.
 */
export function ToolEntry({ label, request, result, running, failed, doneIcon = "check", icon, details }: ToolEntryProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="w-full">
      <Collapsible.Trigger className="group text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-full items-center gap-1.5 rounded-md py-1 text-sm outline-none focus-visible:ring-[3px]">
        {/* Nudged 1px down: lowercase text sits slightly below the line's center, so the icon matches it. */}
        <span className="flex w-4 shrink-0 translate-y-px items-center justify-center">
          {running ? (
            <LoaderCircleIcon aria-label="Running" className="size-3.5 animate-spin text-muted-foreground" />
          ) : failed ? (
            <XIcon aria-label="Failed" className="size-3.5 text-destructive" />
          ) : icon !== undefined ? (
            icon
          ) : doneIcon === "pencil" ? (
            <PencilIcon aria-label="Edited" className="size-3.5 text-muted-foreground" />
          ) : doneIcon === "file" ? (
            <FileTextIcon aria-label="Read" className="size-3.5 text-muted-foreground" />
          ) : (
            <CheckIcon aria-label="Done" className="size-3.5 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 truncate text-start">{label}</span>
        {/* Shown on hover, and kept while the row is open; it sits right after the text. */}
        <ChevronRightIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 opacity-0 transition-[rotate,opacity] duration-200 group-hover:opacity-60 group-data-[state=open]:rotate-90 group-data-[state=open]:opacity-60 motion-reduce:transition-none"
        />
      </Collapsible.Trigger>
      {details !== undefined ? (
        <Collapsible.Content className="mt-2">{details}</Collapsible.Content>
      ) : (
        <Collapsible.Content className="bg-card mt-2 flex flex-col gap-3 rounded-xl border p-3 text-xs">
          <div>
            <p className="text-muted-foreground mb-1 font-mono">Request</p>
            <pre className="font-mono break-words whitespace-pre-wrap">{request}</pre>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 font-mono">Result</p>
            <pre
              className={cn("font-mono break-words whitespace-pre-wrap", failed && "text-destructive")}
            >
              {result}
            </pre>
          </div>
        </Collapsible.Content>
      )}
    </Collapsible.Root>
  );
}
