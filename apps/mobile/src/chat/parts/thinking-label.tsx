import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { usePreferences } from "@/preferences";

// The words and the timing of a thinking block, as the web app shows them (services/web/src/components/chat/thinking-label.tsx
// and turn-timing-view.ts). The server sends the timing in the message metadata.

/** "3s" under a minute, then "5m 32s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** "Thinking 3s" while it runs, "Thought for 4s" once it has ended. */
export function thinkingText(durationMs: number | undefined, live: boolean): string {
  if (live) return durationMs === undefined ? "Thinking" : `Thinking ${formatDuration(durationMs)}`;
  if (durationMs === undefined) return "Thought";
  if (durationMs < 1000) return "Thought for less than a second";
  return `Thought for ${formatDuration(durationMs)}`;
}

/**
 * Milliseconds since `startedAt`, updated every second while `live`. Until the server's start time is known, it counts from
 * when the component appeared, which is when the message was sent.
 */
export function useElapsed(startedAt: number | undefined, live: boolean): number {
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);
  return Math.max(0, now - (startedAt ?? mountedAt));
}

/**
 * Shown from the send until the model starts thinking (or answers): the request is on its way, and nothing else is known
 * yet. The "Thinking Xs" line comes only with the thinking itself.
 */
export function PendingSpinner() {
  const { colors } = usePreferences();
  return (
    <View style={styles.pending} accessibilityRole="progressbar" accessibilityLabel="Sending">
      <ActivityIndicator size="small" color={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  pending: { alignSelf: "flex-start", paddingVertical: 6 },
});
