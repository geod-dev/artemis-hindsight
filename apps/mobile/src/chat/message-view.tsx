import { ActionBarPrimitive, BranchPickerPrimitive, MessagePrimitive, useAuiState } from "@assistant-ui/react-native";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Square } from "lucide-react-native";
import { usePreferences } from "@/preferences";
import { MessageParts } from "./message-parts";
import { FilePart, ImagePart } from "./parts/file-part";

/**
 * One message row. No buttons on the message: a long press on the content opens a sheet with its options
 * (copy, regenerate, switch between versions). User messages sit in a bubble on the right, replies full width.
 */
export function MessageView() {
  const role = useAuiState((s) => s.message.role);
  const parts = useAuiState((s) => s.message.parts);
  const isUser = role === "user";
  const { colors } = usePreferences();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The user's files sit above the bubble, as on the web: images as thumbnails, other files as cards.
  // The runtime keeps a message's composer attachments apart from its parts (message.attachments, each with its content),
  // while messages loaded from the server carry their files as parts. Both are shown.
  // Select the stored array as is: a fallback like `?? []` inside the selector returns a new array on every read,
  // which makes useAuiState loop forever. The fallback is applied outside the selector instead.
  const storedAttachments = useAuiState(
    (s) => (s.message as unknown as { attachments?: { content?: unknown[] }[] }).attachments,
  );
  const attachments = storedAttachments ?? NO_ATTACHMENTS;
  type MessageFile = { type: string; mediaType?: string; mimeType?: string; url?: string; data?: string; filename?: string; image?: string };
  const partFiles = (parts as unknown as MessageFile[]).filter((part) => part.type === "file" || part.type === "image");
  const attachedFiles = attachments.flatMap((attachment) => (attachment.content ?? []) as MessageFile[]);
  const files = isUser ? [...partFiles, ...attachedFiles.filter((part) => part.type === "file" || part.type === "image")] : [];
  const mediaTypeOf = (file: MessageFile) => file.mediaType ?? file.mimeType ?? "";
  const isImageFile = (file: MessageFile) => mediaTypeOf(file).startsWith("image/") || file.type === "image";
  const urlOf = (file: MessageFile) => file.url ?? file.data ?? file.image ?? "";
  // A reply the user stopped says so, as on the web.
  const stopped = useAuiState((s) => s.message.status?.type === "incomplete" && (s.message.status as { reason?: string }).reason === "cancelled");

  return (
    <MessagePrimitive.Root style={isUser ? styles.userRow : styles.assistantRow}>
      {files.length > 0 ? (
        <View style={styles.userFiles}>
          {files.some(isImageFile) ? (
            <View style={styles.imageRow}>
              {files.filter(isImageFile).map((file, index) => (
                <ImagePart key={`image-${index}`} url={urlOf(file)} />
              ))}
            </View>
          ) : null}
          {files.filter((file) => !isImageFile(file)).map((file, index) => (
            <FilePart key={`file-${index}`} url={urlOf(file)} filename={file.filename} mimeType={mediaTypeOf(file)} />
          ))}
        </View>
      ) : null}
      <Pressable
        onLongPress={() => setSheetOpen(true)}
        delayLongPress={350}
        accessibilityHint="Long press for options"
        style={isUser ? [styles.userBubble, { backgroundColor: colors.user }] : undefined}
      >
        <MessageParts role={isUser ? "user" : "assistant"} />
      </Pressable>
      {!isUser && stopped ? <StoppedLabel /> : null}
      <MessageSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} isUser={isUser} />
    </MessagePrimitive.Root>
  );
}

const NO_ATTACHMENTS: { content?: unknown[] }[] = [];

/** The pill under a reply the user stopped: the web's "stopped by you". */
function StoppedLabel() {
  const { colors } = usePreferences();
  return (
    <View style={[styles.stopped, { borderColor: colors.border }]}>
      <Square size={9} color={colors.muted} fill={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Stopped by you</Text>
    </View>
  );
}

/** The options of one message, in a bottom sheet. Tap outside to close it. */
function MessageSheet({ visible, onClose, isUser }: { visible: boolean; onClose: () => void; isUser: boolean }) {
  const { colors } = usePreferences();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <ActionBarPrimitive.Copy style={[styles.option, { borderColor: colors.border }]}>
            {({ isCopied }) => <Text style={[styles.optionText, { color: colors.text }]}>{isCopied ? "Copied" : "Copy"}</Text>}
          </ActionBarPrimitive.Copy>
          {isUser ? null : (
            <>
              <ActionBarPrimitive.Reload style={[styles.option, { borderColor: colors.border }]}>
                <Text style={[styles.optionText, { color: colors.text }]}>Regenerate</Text>
              </ActionBarPrimitive.Reload>
              <View style={[styles.option, styles.versions, { borderColor: colors.border }]}>
                <BranchPickerPrimitive.Previous style={styles.versionButton}>
                  <Text style={[styles.optionText, { color: colors.text }]}>‹ Previous</Text>
                </BranchPickerPrimitive.Previous>
                <BranchPickerPrimitive.Number style={styles.versionButton} />
                <BranchPickerPrimitive.Next style={styles.versionButton}>
                  <Text style={[styles.optionText, { color: colors.text }]}>Next ›</Text>
                </BranchPickerPrimitive.Next>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: "flex-end", gap: 6 },
  // The files sit above the bubble, on the right like it: the pictures side by side, the other files one per line.
  userFiles: { maxWidth: "85%", gap: 6, alignItems: "flex-end" },
  imageRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 },
  stopped: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  userBubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  assistantRow: { gap: 6 },
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 10, gap: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  option: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 16 },
  versions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  versionButton: { paddingVertical: 4, paddingHorizontal: 6 },
});
