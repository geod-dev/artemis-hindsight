import { useMemo, type ReactNode } from "react";
import { Pressable, Text, View, type TextStyle } from "react-native";
import Markdown, { Renderer, type MarkedStyles } from "react-native-marked";
import { usePreferences } from "@/preferences";
import { parseSandboxFileHref } from "@/lib/sandbox-files";
import { renderVisual, VISUAL_LANGUAGES } from "../visuals";
import { useConversationId } from "../conversation-context";
import { openSandboxFile } from "./file-part";
import { groupSourceLinks, parseSourceHref } from "../source-links";
import { SourceBadge } from "./source-badge";
import { SandboxFileCard } from "./sandbox-file-card";
import { CodeBlock } from "./code-block";

// Headings sized closer to the body text, and no rule under them: the library draws a 1px border under h1 and h2 by default.
// Inline code is upright monospace, as on the web (the library's default is italic).
const markdownStyles: MarkedStyles = {
  h1: { fontSize: 19, fontWeight: "600", borderBottomWidth: 0, marginTop: 12, marginBottom: 6 },
  h2: { fontSize: 17, fontWeight: "600", borderBottomWidth: 0, marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 16, fontWeight: "600", marginTop: 8, marginBottom: 4 },
  // The web's inline code is 0.85em of the text: a little smaller, so it reads as code without shouting.
  codespan: { fontFamily: "monospace", fontStyle: "normal", fontWeight: "400", fontSize: 13 },
};

type Segment =
  | { kind: "markdown"; text: string }
  | { kind: "visual"; language: string; code: string; closed: boolean }
  | { kind: "file"; path: string };

// A sandbox file link the agent writes: [label](#sandbox-file:<path>), with or without angle brackets.
const FILE_LINK = /\[([^\]\n]*)\]\(\s*<?(#sandbox-file:[^)\s>]+)>?\s*\)/g;

/**
 * Takes the sandbox file links out of the markdown: each becomes a file card between the text around it, as the web app
 * draws them (a card is a block, it cannot sit inside a sentence on the phone).
 */
function splitFiles(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const segment of segments) {
    if (segment.kind !== "markdown") {
      out.push(segment);
      continue;
    }
    let last = 0;
    for (const match of segment.text.matchAll(FILE_LINK)) {
      const index = match.index ?? 0;
      const path = parseSandboxFileHref(match[2]);
      if (index > last) out.push({ kind: "markdown", text: segment.text.slice(last, index) });
      if (path) out.push({ kind: "file", path });
      else out.push({ kind: "markdown", text: match[0] });
      last = index + match[0].length;
    }
    if (last < segment.text.length) out.push({ kind: "markdown", text: segment.text.slice(last) });
  }
  return out.filter((segment) => segment.kind !== "markdown" || segment.text.trim() !== "");
}

const OPENING_FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;

/**
 * Splits a reply into markdown and visual blocks. A visual block is a fenced code block whose language is one of the
 * agent's visuals (chart, diagram, image group, ...): the others stay markdown, as on the web app. A block still
 * streaming (no closing fence yet) is a visual with `closed: false`, so it shows as a skeleton.
 */
export function splitVisuals(text: string): Segment[] {
  const lines = text.split("\n");
  const segments: Segment[] = [];
  let markdown: string[] = [];
  const flush = () => {
    if (markdown.length > 0) segments.push({ kind: "markdown", text: markdown.join("\n") });
    markdown = [];
  };

  let i = 0;
  while (i < lines.length) {
    const open = OPENING_FENCE.exec(lines[i] ?? "");
    if (!open) {
      markdown.push(lines[i] ?? "");
      i++;
      continue;
    }
    const marker = open[1] ?? "```";
    const language = (open[2] ?? "").toLowerCase();
    const closing = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`);
    let end = i + 1;
    while (end < lines.length && !closing.test(lines[end] ?? "")) end++;
    const closed = end < lines.length;
    const blockEnd = closed ? end + 1 : lines.length;

    if (VISUAL_LANGUAGES.has(language)) {
      flush();
      segments.push({ kind: "visual", language, code: lines.slice(i + 1, end).join("\n"), closed });
    } else {
      markdown.push(...lines.slice(i, blockEnd));
    }
    i = blockEnd;
  }
  flush();
  return segments;
}

/**
 * The markdown renderer of one conversation. Its links to sandbox files (the agent writes [label](#sandbox-file:<path>))
 * are downloaded with the session; every other link is rendered as the library does.
 */
/** A short hash of a text, stable across renders (a React key). */
function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (Math.imul(hash, 33) ^ text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

function createReplyRenderer(conversationId: string, textStyle: TextStyle): Renderer {
  class ReplyRenderer extends Renderer {
    // A fenced code block is a real code block: highlighted for its language, scrolling sideways (see code-block.tsx).
    // The key comes from the block's content, not from the renderer's counter: the library re-parses the reply on every
    // streamed chunk, and a counter key would remount the block (and its sideways scroll) each time.
    code(text: string, language?: string): ReactNode {
      return <CodeBlock key={`code-${language ?? ""}-${hashText(text)}`} code={text} language={language ?? ""} />;
    }

    // Inline code: a nested Text cannot have padding or rounded corners, so the highlight gets its side padding from
    // two quarter-em spaces inside the background (the web's px-1.5).
    codespan(text: string, styles?: TextStyle): ReactNode {
      return super.codespan(` ${text} `, styles);
    }

    link(children: string | ReactNode[], href: string, styles?: TextStyle, title?: string): ReactNode {
      const source = parseSourceHref(href);
      if (source) {
        const label = typeof children === "string" ? children : "";
        return <SourceBadge key={this.getKey()} url={source} label={label} />;
      }
      const path = parseSandboxFileHref(href);
      if (!path) return super.link(children, href, styles, title);
      return (
        <Pressable key={this.getKey()} accessibilityRole="link" accessibilityLabel={title ?? "File"} onPress={() => void openSandboxFile(conversationId, path)}>
          <Text style={[textStyle, styles, { textDecorationLine: "underline" }]}>{children}</Text>
        </Pressable>
      );
    }
  }
  // Not selectable: a long press on the reply opens the message options instead of selecting a word.
  return new ReplyRenderer({ selectable: false });
}

/** The text of an assistant message: markdown, with the agent's visuals rendered in place. */
export function TextPart({ text }: { text: string }) {
  const { colors } = usePreferences();
  const conversationId = useConversationId();
  // Source groups become badges (see source-links.ts), before the visuals are split out.
  const segments = useMemo(() => splitFiles(splitVisuals(groupSourceLinks(text))), [text]);

  const theme = useMemo(
    () => ({
      // The reply sits on the thread's own background: the markdown container must not paint its own (it showed
      // a dark block in light mode, from the library's default colors).
      colors: {
        text: colors.text,
        background: "transparent",
        // The inline code's background: it must show on the reply's background (the card colour is white in light mode).
        code: colors.surfaceStrong,
        link: colors.accent,
        border: colors.border,
      },
    }),
    [colors],
  );

  const renderer = useMemo(() => createReplyRenderer(conversationId, { color: colors.text }), [conversationId, colors.text]);

  return (
    <View style={{ gap: 8 }}>
      {segments.map((segment, index) =>
        segment.kind === "visual" ? (
          <View key={index}>{renderVisual(segment.language, segment.code, segment.closed)}</View>
        ) : segment.kind === "file" ? (
          <SandboxFileCard key={index} conversationId={conversationId} path={segment.path} />
        ) : (
          <Markdown
            key={index}
            value={segment.text}
            theme={theme}
            styles={markdownStyles}
            renderer={renderer}
            flatListProps={{ scrollEnabled: false, style: { backgroundColor: "transparent" } }}
          />
        ),
      )}
    </View>
  );
}
