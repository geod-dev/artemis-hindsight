"use client";

import { useAuiState } from "@assistant-ui/react";
import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import { ImageOffIcon, RotateCwIcon, type LucideIcon } from "lucide-react";
import { useMemo, type FC, type ReactNode } from "react";
import type { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// The visuals the agent puts in its replies are code blocks: ```<language>, then the visual's content. The markdown
// renderer hands each block to the component registered for its language (componentsByLanguage).

export const ErrorCard: FC<{ title: string; message: string; icon?: LucideIcon; onRetry?: () => void }> = ({
  title,
  message,
  icon: Icon = ImageOffIcon,
  onRetry,
}) => (
  <Alert className="my-3 w-full max-w-md first:mt-0">
    <Icon />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
          <RotateCwIcon />
          Try again
        </Button>
      )}
    </AlertDescription>
  </Alert>
);

/** A placeholder card for a visual that is still streaming. */
export const VisualSkeleton: FC<{ className?: string; label: string }> = ({ className = "h-40 max-w-md", label }) => (
  <Skeleton className={`my-3 w-full rounded-2xl first:mt-0 ${className}`} aria-busy aria-label={label} />
);

const closedFence = (language: string) =>
  new RegExp(`^[ \\t]*\`\`\`${language}[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n[ \\t]*\`\`\``, "gm");

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Whether this block's closing fence has arrived. While a block streams, its content is cut anywhere, so a visual
 * waits for it. The message text is checked for a closed block with the same content.
 */
export function useFenceClosed(language: string, code: string): boolean {
  const text = useAuiState((s) =>
    s.message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n"),
  );
  const content = normalize(code);
  return useMemo(
    () => [...text.matchAll(closedFence(language))].some((match) => normalize(match[1] ?? "") === content),
    [text, language, content],
  );
}

/**
 * A code block whose content is a JSON object, checked against `schema`, and rendered by `render` once its fence is
 * closed. While it streams, `skeleton` stands in for it; a closed block that is not valid shows an error card.
 */
export function jsonVisual<Schema extends z.ZodType>(options: {
  language: string;
  name: string;
  schema: Schema;
  render: (value: z.output<Schema>) => ReactNode;
  skeleton: ReactNode;
}): FC<SyntaxHighlighterProps> {
  const JsonVisual: FC<SyntaxHighlighterProps> = ({ code }) => {
    const closed = useFenceClosed(options.language, code);
    const parsed = useMemo(() => {
      if (!closed) return undefined;
      try {
        return options.schema.safeParse(JSON.parse(code));
      } catch {
        return undefined;
      }
    }, [closed, code]);

    if (!closed) return options.skeleton;
    if (!parsed?.success) {
      const reason = parsed ? (parsed.error.issues[0]?.message ?? "invalid content") : "its JSON does not parse";
      return <ErrorCard title={`${options.name} unavailable`} message={`The ${options.name.toLowerCase()} is malformed: ${reason}.`} />;
    }
    return options.render(parsed.data);
  };
  return JsonVisual;
}

/** The componentsByLanguage entry of a visual: the block renders as the visual, with no code header. */
export const visualLanguage = (SyntaxHighlighter: FC<SyntaxHighlighterProps>) => ({
  SyntaxHighlighter,
  CodeHeader: () => null,
});
