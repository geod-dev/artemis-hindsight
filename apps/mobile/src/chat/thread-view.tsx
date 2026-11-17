import { ThreadPrimitive } from "@assistant-ui/react-native";
import { useEffect, useRef, type ComponentRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardState, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { usePreferences } from "@/preferences";
import { BrandMark } from "@/components/brand-mark";
import { Composer } from "./composer";
import { MessageView } from "./message-view";

/** The messages of the conversation (virtualized) above the composer. */
export function ThreadView({ conversationId }: { conversationId: string }) {
  const { colors } = usePreferences();
  // The keyboard's own animation, frame by frame: its height is negative while it is open. The chat's bottom padding
  // follows it, so the messages shrink and the composer rises with the keyboard, as the keyboard moves. The window does
  // not resize on Android (edge-to-edge), so the view has to make room itself.
  const { height } = useReanimatedKeyboardAnimation();
  const keyboardPadding = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -height.value) }));

  // When the keyboard opens, the conversation stays at its last message.
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const list = useRef<ComponentRef<typeof ThreadPrimitive.MessagesFlatList>>(null);
  useEffect(() => {
    if (!keyboardVisible) return undefined;
    // After the keyboard's animation has made room (about the animation's length).
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 300);
    return () => clearTimeout(id);
  }, [keyboardVisible]);

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background }, keyboardPadding]}>
      <ThreadPrimitive.Root style={styles.root}>
        <ThreadPrimitive.Empty>
          <View style={styles.empty}>
            <BrandMark size={72} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>What do you want to know?</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>Ask a question, add a file, or dictate your message.</Text>
          </View>
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.MessagesFlatList
          ref={list}
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 16 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: "600" },
  emptyBody: { fontSize: 15, textAlign: "center" },
});
