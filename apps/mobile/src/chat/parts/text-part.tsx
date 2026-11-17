import { useMemo, type ReactNode } from "react";
import { Pressable, Text, View, type TextStyle } from "react-native";
import Markdown, { Renderer } from "react-native-marked";
import { usePreferences } from "@/preferences";
import { parseSandboxFileHref } from "@/lib/sandbox-files";
import { renderVisual, VISUAL_LANGUAGES } from "../visuals";
import { useConversationId } from "../conversation-context";
import { openSandboxFile } from "./file-part";
import { groupSourceLinks, parseSourceHref } from "../source-links";
import { SourceBadge } from "./source-badge";
import { SandboxFileCard } from "./sandbox-file-card";


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
function createReplyRenderer(conversationId: string, textStyle: TextStyle): Renderer {
  class ReplyRenderer extends Renderer {
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
        code: colors.surface,
        // The markdown's own rules and table lines: the muted tone, the palette's only secondary colour.
        border: colors.muted,
        link: colors.accent,
      },
    }),
    [colors],
  );

  const renderer = useMemo(() => createReplyRenderer(conversationId, { color: colors.text }), [conversationId, colors.text]);

  return (
    <View>
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
            renderer={renderer}
            flatListProps={{ scrollEnabled: false, style: { backgroundColor: "transparent" } }}
          />
        ),
      )}
    </View>
  );
}
