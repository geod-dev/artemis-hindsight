import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ThemedToken } from "shiki/core";
import { useAuiState } from "@assistant-ui/react-native";
import { usePreferences } from "@/preferences";
import { HorizontalRow } from "../visuals/shared";
import { highlightCode } from "./code-highlight";

// The web's fenced code block (services/web/src/components/chat/code-block.tsx and assistant-ui/elements/shiki-highlighter.tsx):
// a bordered box with the language on a header row, the code in a sideways-scrolling monospace block, highlighted once
// the reply is done. While the reply streams the code is plain, so the highlighter does not run on every chunk.

type HighlightState = { key: string; lines: ThemedToken[][] };

/** The highlighted lines of a block, once they are ready. Undefined while plain, or for a fence with no grammar. */
function useHighlightedLines(code: string, fence: string, dark: boolean, enabled: boolean): ThemedToken[][] | undefined {
  const key = `${dark}|${fence}|${code}`;
  const [state, setState] = useState<HighlightState>();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    highlightCode(code, fence, dark).then(
      (lines) => {
        if (active && lines) setState({ key, lines });
      },
      () => {
        // A grammar that fails to load leaves the block plain: the code is still there.
      },
    );
    return () => {
      active = false;
    };
  }, [key, code, fence, dark, enabled]);

  return enabled && state?.key === key ? state.lines : undefined;
}

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const { colors, isDark } = usePreferences();
  const running = useAuiState((s) => s.message.status?.type === "running");
  const text = code.replace(/\n$/, "");
  const fence = language.trim();
  const lines = useHighlightedLines(text, fence, isDark, !running);

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {fence ? (
        <View style={[styles.header, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
          <Text style={[styles.language, { color: colors.muted }]}>{fence.toLowerCase()}</Text>
        </View>
      ) : null}
      {/* The same sideways scroll as the image group: the drawer's swipe waits for it. */}
      <HorizontalRow contentStyle={styles.body}>
        <Text selectable={false} style={[styles.code, { color: colors.text }]}>
          {lines
            ? lines.map((line, row) => (
                <Text key={row}>
                  {line.map((token, column) => (
                    <Text key={column} style={{ color: token.color }}>
                      {token.content}
                    </Text>
                  ))}
                  {row < lines.length - 1 ? "\n" : ""}
                </Text>
              ))
            : text}
        </Text>
      </HorizontalRow>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: "hidden", marginVertical: 6 },
  header: { paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  language: { fontSize: 12, fontWeight: "500" },
  body: { padding: 14 },
  code: { fontFamily: "monospace", fontSize: 13, lineHeight: 20 },
});
