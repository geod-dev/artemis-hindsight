import { ThreadPrimitive } from "@assistant-ui/react-native";
import { useRef, useState, type ComponentRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { ChevronDown } from "lucide-react-native";
import { usePreferences } from "@/preferences";
import { BrandMark } from "@/components/brand-mark";
import { Composer, composerSurface } from "./composer";
import { MessageView } from "./message-view";

/** Within this many pixels of the end, the conversation counts as scrolled to the bottom. */
const AT_BOTTOM_PX = 60;

/**
 * The messages of the conversation (virtualized) above the composer. When the keyboard opens, the whole chat (messages and
 * composer) moves up by the keyboard's height, frame by frame with the keyboard's own animation. The composer rises with the
 * keyboard and the conversation scrolls by the same amount; nothing else changes. The window does not resize on Android
 * (edge-to-edge), so the chat moves itself; the parent clips what goes above the header.
 */
export function ThreadView({ conversationId }: { conversationId: string }) {
  const { colors, isDark } = usePreferences();
  // Negative while the keyboard is open (the keyboard controller's convention, as in its examples).
  const { height } = useReanimatedKeyboardAnimation();
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: height.value }] }));

  // A button above the composer returns to the newest message when the conversation is not scrolled to the bottom.
  const list = useRef<ComponentRef<typeof ThreadPrimitive.MessagesFlatList>>(null);
  const [atBottom, setAtBottom] = useState(true);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setAtBottom(contentSize.height - layoutMeasurement.height - contentOffset.y <= AT_BOTTOM_PX);
  };

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
          <View style={styles.list}>
            <ThreadPrimitive.MessagesFlatList
              ref={list}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              autoScroll
              scrollToBottomOnInitialize
              scrollToBottomOnRunStart
              scrollToBottomOnThreadSwitch
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
            >
              {() => <MessageView />}
            </ThreadPrimitive.MessagesFlatList>
            {atBottom ? null : (
              <View style={styles.jumpLayer} pointerEvents="box-none">
                <Pressable
                  onPress={() => list.current?.scrollToEnd({ animated: true })}
                  accessibilityRole="button"
                  accessibilityLabel="Scroll to the latest message"
                  style={[styles.jump, { backgroundColor: composerSurface(colors, isDark), borderColor: colors.border }]}
                >
                  <ChevronDown size={20} color={colors.text} />
                </Pressable>
              </View>
            )}
          </View>
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
  jumpLayer: { ...StyleSheet.absoluteFill, justifyContent: "flex-end", alignItems: "center", paddingBottom: 12 },
  jump: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
});
