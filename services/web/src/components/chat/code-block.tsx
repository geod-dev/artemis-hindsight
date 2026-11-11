"use client";

import { useAuiState } from "@assistant-ui/react";
import type { FC } from "react";
import { bundledLanguages } from "shiki/langs";
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/shiki-highlighter";

// Fence names that mean plain text. Shiki renders "text" without loading a grammar.
const PLAIN_TEXT_FENCES = new Set(["", "text", "plaintext", "plain", "txt"]);

/** The Shiki language for a fence: its grammar when Shiki has one, otherwise plain text. */
const languageOf = (fence: string | undefined): string => {
  const id = (fence ?? "").trim().toLowerCase();
  if (PLAIN_TEXT_FENCES.has(id)) return "text";
  return Object.hasOwn(bundledLanguages, id) ? id : "text";
};

type CodeBlockProps = {
  code: string;
  language?: string;
};

/**
 * A fenced code block in an assistant message, highlighted for the language on its fence.
 * It stays plain while the message streams and highlights once the message is done.
 * Passed as the `SyntaxHighlighter` of the markdown components.
 */
export const CodeBlock: FC<CodeBlockProps> = ({ code, language }) => {
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  return <SyntaxHighlighter code={code} language={languageOf(language)} streaming={streaming} />;
};
