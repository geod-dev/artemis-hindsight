import { ThreadPrimitive } from "@assistant-ui/react-native";
import { StyleSheet, Text, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { usePreferences } from "@/preferences";
import { BrandMark } from "@/components/brand-mark";
import { Composer } from "./composer";
import { MessageView } from "./message-view";

/** The messages of the conversation (virtualized) above the composer. */
export function ThreadView({ conversationId }: { conversationId: string }) {
  const { colors } = usePreferences();
  // The keyboard's height, in screen coordinates, as a bottom padding of the whole chat: the messages shrink and the
  // composer (at the bottom) sits right on top of the keyboard. The window does not resize on Android (edge-to-edge), so
  // the view has to make room itself.
  const keyboardHeight = useKeyboardState((state) => (state.isVisible ? state.height : 0));
  return (
    <ThreadPrimitive.Root style={[styles.root, { backgroundColor: colors.background, paddingBottom: keyboardHeight }]}>
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
