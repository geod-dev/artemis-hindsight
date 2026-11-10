import type { ReactNode } from "react";
import { CodeDiff, type DiffLine } from "@/components/assistant-ui/elements/code-diff";

/** The sandbox tools that work on one file. They get a file label, a file icon and a code diff when expanded. */
export const FILE_TOOLS = new Set(["write", "read", "edit"]);

/** Longer diffs are cut here: the component staggers each line by 60ms, so a long file would take seconds to show. */
const MAX_DIFF_LINES = 40;

/** Which icon the row shows once the call is done. */
export function fileToolDoneIcon(toolName: string): "pencil" | "file" {
  return toolName === "read" ? "file" : "pencil";
}

/** "Wrote notes.md" once done, "Writing notes.md" while running. The path is shown by its file name. */
export function fileToolLabel(toolName: string, path: unknown, finished: boolean): string {
  const name = fileName(path);
  const verbs: Record<string, string> = {
    write: finished ? "Wrote" : "Writing",
    read: finished ? "Read" : "Reading",
    edit: finished ? "Edited" : "Editing",
  };
  const verb = verbs[toolName];
  return `${verb ?? toolName} ${name}`;
}

/**
 * The expanded view of a file call: a code diff. Write shows the new file as added lines, edit shows the
 * replaced text as removed and the new text as added, read shows the file's lines as context.
 * Returns undefined when there is nothing to show yet, so the row falls back to the plain request and result.
 */
export function fileToolDetails(
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  finished: boolean,
): ReactNode | undefined {
  const filename = fileName(args.path);

  if (toolName === "write") {
    const added = linesOf(args.content, "added");
    return diff(filename, added.length, 0, added);
  }

  if (toolName === "edit") {
    const removed = linesOf(args.oldString, "removed");
    const added = linesOf(args.newString, "added");
    return diff(filename, added.length, removed.length, [...removed, ...added]);
  }

  if (toolName === "read" && finished) {
    const content = asRecord(result).content;
    if (typeof content !== "string") return undefined;
    // The sandbox numbers each line ("    12\ttext"); the diff shows the text only.
    const lines = content.split("\n").map((line): DiffLine => ({ kind: "context", text: line.replace(/^\s*\d+\t/, "") }));
    return diff(filename, 0, 0, lines);
  }

  return undefined;
}

function diff(filename: string, additions: number, deletions: number, lines: DiffLine[]): ReactNode {
  const shown = lines.slice(0, MAX_DIFF_LINES);
  const hidden = lines.length - shown.length;
  if (hidden > 0) shown.push({ kind: "context", text: `… ${hidden} more lines` });
  return <CodeDiff filename={filename} additions={additions} deletions={deletions} lines={shown} cycle={0} />;
}

function linesOf(text: unknown, kind: "added" | "removed"): DiffLine[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  return lines.map((line) => ({ kind, text: line }));
}

function fileName(path: unknown): string {
  return typeof path === "string" ? path.split(/[\\/]/).pop() || path : "file";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
