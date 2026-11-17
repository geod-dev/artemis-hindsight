import { ThreadPrimitive } from "@assistant-ui/react-native";
import { Button, Column, Text } from "@expo/ui";
import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { usePreferences } from "@/preferences";
import { BrandMark } from "@/components/brand-mark";
import { Composer } from "./composer";
import { MessageView } from "./message-view";
import { ProjectRecents } from "./project-recents";

/** Within this many pixels of the end, the conversation counts as scrolled to the bottom. */
const AT_BOTTOM_PX = 60;

/**
 * The messages of the conversation (virtualized) above the composer, and the composer. When the keyboard opens, the chat
 * behaves like a classic chat: while the messages are shorter than the space above the composer, that space shrinks; once
 * the messages fill it, the whole chat moves up by the rest, so the conversation scrolls with the composer. The keyboard's
 * own animation drives both, frame by frame. The window does not resize on Android (edge-to-edge), so the chat moves itself.
 */
export function ThreadView({
  conversationId,
  projectId = null,
  mascotTint,
  projectPicker,
}: {
  conversationId: string;
  /** The new chat's project: its recent conversations show under the composer while the chat is empty. */
  projectId?: string | null;
  /** The mascot's color in the empty chat, when a project is selected. */
  mascotTint?: string;
  /** The project picker, shown under the mascot in the empty chat. */
  projectPicker?: ReactNode;
}) {
  const { colors } = usePreferences();

  // The sizes that decide how much room the messages have: the chat's height, the composer's, and the messages' content.
  const sizes = useRef({ chat: 0, composer: 0, content: 0 });
  // Free space above the composer that the messages do not use (shared, so the animation can read it).
  const freeSpace = useSharedValue(0);
  const updateFreeSpace = () => {
    const { chat, composer, content } = sizes.current;
    freeSpace.value = Math.max(0, chat - composer - content);
  };

  // The keyboard's height, growing while it opens (its own animation is negative while open).
  const { height } = useReanimatedKeyboardAnimation();
  const keyboardHeight = useDerivedValue(() => Math.max(0, -height.value));
  // Part of the keyboard's height that the free space absorbs (the chat shrinks), and the rest, which moves the chat up.
  const shrink = useDerivedValue(() => Math.min(keyboardHeight.value, freeSpace.value));
  const chatStyle = useAnimatedStyle(() => ({
    paddingBottom: shrink.value,
    transform: [{ translateY: -(keyboardHeight.value - shrink.value) }],
  }));

  // A button above the composer returns to the newest message when the conversation is not scrolled to the bottom.
  const list = useRef<ComponentRef<typeof ThreadPrimitive.MessagesFlatList>>(null);
  const [atBottom, setAtBottom] = useState(true);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setAtBottom(contentSize.height - layoutMeasurement.height - contentOffset.y <= AT_BOTTOM_PX);
  };

  return (
    <View
      style={styles.clip}
      onLayout={(event) => {
        sizes.current.chat = event.nativeEvent.layout.height;
        updateFreeSpace();
      }}
    >
      <Animated.View style={[styles.root, { backgroundColor: colors.background }, chatStyle]}>
        <ThreadPrimitive.Root style={styles.root}>
          <ThreadPrimitive.Empty>
            <View style={styles.empty}>
              <BrandMark size={72} tint={mascotTint} />
              <M3Host matchContents={{ vertical: true }}>
                <Column>
                  <Text>What do you want to know?</Text>
                  <Text>Ask a question, add a file, or dictate your message.</Text>
                </Column>
              </M3Host>
              {projectPicker}
            </View>
          </ThreadPrimitive.Empty>
          <View style={styles.list}>
            <ThreadPrimitive.MessagesFlatList
              ref={list}
              style={styles.list}
              autoScroll
              scrollToBottomOnInitialize
              scrollToBottomOnRunStart
              scrollToBottomOnThreadSwitch
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              onContentSizeChange={(_width, height) => {
                sizes.current.content = height;
                updateFreeSpace();
              }}
            >
              {() => <MessageView />}
            </ThreadPrimitive.MessagesFlatList>
            {atBottom ? null : (
              <View style={styles.jumpLayer} pointerEvents="box-none">
                <M3Host matchContents>
                  <Button variant="outlined" onPress={() => list.current?.scrollToEnd({ animated: true })}>
                    <Glyph name="chevronDown" />
                  </Button>
                </M3Host>
              </View>
            )}
          </View>
          <View
            onLayout={(event) => {
              sizes.current.composer = event.nativeEvent.layout.height;
              updateFreeSpace();
            }}
          >
            <Composer conversationId={conversationId} />
            {projectId ? (
              <ThreadPrimitive.Empty>
                <ProjectRecents projectId={projectId} />
              </ThreadPrimitive.Empty>
            ) : null}
          </View>
        </ThreadPrimitive.Root>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: "hidden" },
  root: { flex: 1 },
  list: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  // The jump button sits over the bottom of the messages, centred (its position, not a margin).
  jumpLayer: { ...StyleSheet.absoluteFill, justifyContent: "flex-end", alignItems: "center" },
});
