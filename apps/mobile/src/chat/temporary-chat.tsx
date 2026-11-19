import { useAuiState } from "@assistant-ui/react-native";
import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { MessageCircleDashed, User, UserX } from "lucide-react-native";
import { ActionSheet, ActionSheetOption } from "@/components/action-sheet";
import { apiFetch } from "@/lib/api";
import {
  KEEPALIVE_INTERVAL_MS,
  TEMPORARY_CHAT_TITLE,
  TEMPORARY_MODE_LABELS,
  type TemporaryMode,
} from "@/lib/temporary-chat";
import { usePreferences } from "@/preferences";

// The temporary chat's controls and signs. Same behaviour as services/web/src/components/chat/temporary-chat.tsx; the
// mode is picked in a bottom sheet here, as the top bar has no room for the web's menu beside the switch.

/**
 * The new chat's temporary switch, on the right of the top bar. Off, a tap opens a sheet to pick the mode, which turns
 * it on; on, a tap turns it off.
 */
export function TemporaryChatButton({
  value,
  onChange,
}: {
  value: TemporaryMode | null;
  onChange: (mode: TemporaryMode | null) => void;
}) {
  const { colors } = usePreferences();
  const [picking, setPicking] = useState(false);
  const choose = (mode: TemporaryMode) => {
    setPicking(false);
    onChange(mode);
  };

  return (
    <>
      <Pressable
        onPress={() => (value ? onChange(null) : setPicking(true))}
        accessibilityRole="switch"
        accessibilityLabel={TEMPORARY_CHAT_TITLE}
        accessibilityState={{ checked: value !== null }}
        hitSlop={8}
        style={[styles.button, value ? { backgroundColor: colors.surfaceStrong } : null]}
      >
        <MessageCircleDashed size={22} color={colors.text} />
      </Pressable>
      <ActionSheet visible={picking} onClose={() => setPicking(false)}>
        <Text style={[styles.sheetTitle, { color: colors.muted }]}>{TEMPORARY_CHAT_TITLE}</Text>
        <ActionSheetOption label={TEMPORARY_MODE_LABELS.personalized} icon={User} onPress={() => choose("personalized")} />
        <ActionSheetOption label={TEMPORARY_MODE_LABELS.unpersonalized} icon={UserX} onPress={() => choose("unpersonalized")} />
      </ActionSheet>
    </>
  );
}

/** The top bar's title in a temporary chat, which is never named: "Temporary chat", and the mode when not personalized. */
export function TemporaryChatTitle({ mode }: { mode: TemporaryMode }) {
  const { colors } = usePreferences();
  return (
    <View style={styles.titleRow}>
      <MessageCircleDashed size={20} color={colors.muted} />
      <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
        {TEMPORARY_CHAT_TITLE}
      </Text>
      {mode === "unpersonalized" ? (
        <View style={[styles.badge, { borderColor: colors.border }]}>
          <Text numberOfLines={1} style={[styles.badgeText, { color: colors.muted }]}>
            {TEMPORARY_MODE_LABELS[mode]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Under the mascot of a new temporary chat, in place of the project picker: what a temporary chat is. */
export function TemporaryChatNotice({ mode }: { mode: TemporaryMode }) {
  const { colors } = usePreferences();
  return (
    <Text style={[styles.notice, { color: colors.muted }]}>
      Not saved to your history or memory, and deleted an hour after you leave it.
      {mode === "unpersonalized" ? " Artemis knows nothing about you here." : ""}
    </Text>
  );
}

/**
 * Keeps a temporary chat alive while this screen shows it: the server deletes a temporary chat nobody has kept alive
 * for an hour. It starts with the first message, which creates the chat on the server, and runs again each time the app
 * comes back to the foreground (its timers stop in the background). Renders nothing; mounted inside the chat's runtime.
 */
export function TemporaryChatKeepAlive({ conversationId }: { conversationId: string }) {
  const started = useAuiState((s) => s.thread.messages.length > 0);
  useEffect(() => {
    if (!started) return;
    const keepAlive = () => {
      void apiFetch(`/api/conversations/${conversationId}/keepalive`, { method: "POST" }).catch(() => undefined);
    };
    keepAlive();
    const timer = setInterval(keepAlive, KEEPALIVE_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") keepAlive();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [conversationId, started]);
  return null;
}

/** Tells the screen once the chat has its first message (the new chat hides its temporary switch then). Renders nothing. */
export function ThreadStartWatcher({ onStarted }: { onStarted: () => void }) {
  const started = useAuiState((s) => s.thread.messages.length > 0);
  useEffect(() => {
    if (started) onStarted();
  }, [started, onStarted]);
  return null;
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 13, fontWeight: "600", paddingHorizontal: 24, paddingBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  // Same size and weight as the header's own title, which a custom headerTitle replaces.
  title: { fontSize: 22, fontWeight: "500", flexShrink: 1 },
  badge: { borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, flexShrink: 0 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  notice: { fontSize: 14, textAlign: "center", maxWidth: 320, marginTop: 8 },
});
