import { ActionBarPrimitive, BranchPickerPrimitive, MessagePrimitive, useAuiState } from "@assistant-ui/react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, Copy, Square } from "lucide-react-native";
import { ActionSheet } from "@/components/action-sheet";
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
        delayLongPress={400}
        accessibilityHint="Long press for options"
        style={isUser ? [styles.userBubble, { backgroundColor: colors.user }] : undefined}
      >
        <MessageParts role={isUser ? "user" : "assistant"} />
      </Pressable>
      {!isUser && stopped ? <StoppedLabel /> : null}
      <MessageSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
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
function MessageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = usePreferences();
  // The reply's versions: a previous one and a next one are offered only when the reply has them.
  const branchNumber = useAuiState((s) => s.message.branchNumber);
  const branchCount = useAuiState((s) => s.message.branchCount);
  const hasPrevious = branchNumber > 1;
  const hasNext = branchNumber < branchCount;
  return (
    <ActionSheet visible={visible} onClose={onClose}>
      <ActionBarPrimitive.Copy style={styles.option} android_ripple={{ color: colors.border }}>
        {({ isCopied }) => (
          <View style={styles.optionLead}>
            <Copy size={18} color={colors.text} />
            <Text style={[styles.optionText, { color: colors.text }]}>{isCopied ? "Copied" : "Copy"}</Text>
          </View>
        )}
      </ActionBarPrimitive.Copy>
      {branchCount > 1 ? (
        <View style={[styles.option, styles.versions]}>
          <View style={styles.versionStart}>
            {hasPrevious ? (
              <BranchPickerPrimitive.Previous style={styles.versionButton}>
                <View style={styles.optionLead}>
                  <ChevronLeft size={18} color={colors.text} />
                  <Text style={[styles.optionText, { color: colors.text }]}>Previous</Text>
                </View>
              </BranchPickerPrimitive.Previous>
            ) : null}
          </View>
          <BranchPickerPrimitive.Number style={styles.versionButton} />
          <View style={styles.versionEnd}>
            {hasNext ? (
              <BranchPickerPrimitive.Next style={styles.versionButton}>
                <View style={styles.optionLead}>
                  <Text style={[styles.optionText, { color: colors.text }]}>Next</Text>
                  <ChevronRight size={18} color={colors.text} />
                </View>
              </BranchPickerPrimitive.Next>
            ) : null}
          </View>
        </View>
      ) : null}
    </ActionSheet>
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
  // A transparent row across the full width of the sheet: no border (the sheet's own surface behind it).
  option: { alignSelf: "stretch", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionLead: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  optionText: { fontSize: 16 },
  // The versions row: the previous on the left, the count in the middle, the next on the right; a missing side stays empty,
  // so the count does not move.
  versions: { flexDirection: "row", alignItems: "center" },
  versionStart: { flex: 1, alignItems: "flex-start" },
  versionEnd: { flex: 1, alignItems: "flex-end" },
  versionButton: { paddingVertical: 4, paddingHorizontal: 6 },
});
