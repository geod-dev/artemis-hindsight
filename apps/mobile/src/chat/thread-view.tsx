import { ThreadPrimitive } from "@assistant-ui/react-native";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { usePreferences } from "@/preferences";
import { BrandMark } from "@/components/brand-mark";
import { Composer } from "./composer";
import { MessageView } from "./message-view";

/**
 * The messages of the conversation (virtualized) above the composer. When the keyboard opens, the whole chat (messages and
 * composer) moves up by the keyboard's height, frame by frame with the keyboard's own animation. The composer rises with the
 * keyboard and the conversation scrolls by the same amount; nothing else changes. The window does not resize on Android
 * (edge-to-edge), so the chat moves itself; the parent clips what goes above the header.
 */
export function ThreadView({ conversationId }: { conversationId: string }) {
  const { colors } = usePreferences();
  // Negative while the keyboard is open (the keyboard controller's convention, as in its examples).
  const { height } = useReanimatedKeyboardAnimation();
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: height.value }] }));

  return (
    <View style={styles.clip}>
      <Animated.View style={[styles.root, { backgroundColor: colors.background }, lift]}>
        <ThreadPrimitive.Root style={styles.root}>
          <ThreadPrimitive.Empty>
            <View style={styles.empty}>
              <BrandMark size={72} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>What do you want to know?</Text>
              <Text style={[styles.emptyBody, { color: colors.muted }]}>Ask a question, add a file, or dictate your message.</Text>
            </View>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.MessagesFlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            autoScroll
            scrollToBottomOnInitialize
            scrollToBottomOnRunStart
            scrollToBottomOnThreadSwitch
            keyboardShouldPersistTaps="handled"
          >
            {() => <MessageView />}
          </ThreadPrimitive.MessagesFlatList>
          <Composer conversationId={conversationId} />
        </ThreadPrimitive.Root>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: "hidden" },
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 16 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: "600" },
  emptyBody: { fontSize: 15, textAlign: "center" },
});
