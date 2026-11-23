import { ActionBarPrimitive, BranchPickerPrimitive, MessagePrimitive, useAui, useAuiState } from "@assistant-ui/react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowRight, ChevronLeft, ChevronRight, Copy, Pencil, RefreshCw, Square } from "lucide-react-native";
import { ActionSheet } from "@/components/action-sheet";
import { usePreferences } from "@/preferences";
import { editTint } from "./composer";
import { useContinuedReplies, useReplyStopped } from "./continued-replies";
import { useEditing } from "./editing";
import { MessageLongPressContext } from "./message-long-press";
import { MessageParts, UserTextColorContext } from "./message-parts";
import { FilePart, ImagePart } from "./parts/file-part";

/**
 * One message row. No buttons on the message: a long press on the content opens a sheet with its options
 * (copy, edit a message, regenerate a reply, switch between versions). User messages sit in a bubble on the right, replies
 * full width. A message with other versions (edited, regenerated) shows "‹ 2/3 ›" under it, as on the web.
 * The message being edited in the composer takes the edit's tint, under an "Editing" label.
 */
export function MessageView() {
  const role = useAuiState((s) => s.message.role);
  const parts = useAuiState((s) => s.message.parts);
  const isUser = role === "user";
  const { colors } = usePreferences();
  const messageId = useAuiState((s) => s.message.id);
  const isEdited = useEditing().messageId === messageId;
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
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
  // A reply the user stopped says so, as on the web (see useReplyStopped).
  const stopped = useReplyStopped();

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
      {isEdited ? <Text style={[styles.editingLabel, { color: colors.accent }]}>Editing</Text> : null}
      <Pressable
        onLongPress={openSheet}
        delayLongPress={400}
        accessibilityHint="Long press for options"
        style={
          isUser
            ? [
                styles.userBubble,
                isEdited
                  ? { backgroundColor: editTint(colors.accent), borderColor: colors.accent, borderWidth: 1 }
                  : { backgroundColor: colors.user },
              ]
            : undefined
        }
      >
        <MessageLongPressContext.Provider value={openSheet}>
          <UserTextColorContext.Provider value={isEdited ? colors.text : undefined}>
            <MessageParts role={isUser ? "user" : "assistant"} />
          </UserTextColorContext.Provider>
        </MessageLongPressContext.Provider>
      </Pressable>
      {!isUser && stopped ? <StoppedRow /> : null}
      <VersionPicker />
      <MessageSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </MessagePrimitive.Root>
  );
}

const NO_ATTACHMENTS: { content?: unknown[] }[] = [];

/**
 * Under a reply the user stopped: "Stopped by you", and, on the last reply while nothing runs, Discard and Continue, as on
 * the web (services/web/src/components/chat/stopped-bar.tsx). Discard edits the message the reply answers, in the
 * composer. Continue makes the agent go on with the stopped reply, in the same message (a regenerate of the question that
 * names this reply; the server replays it and streams the rest into it).
 */
function StoppedRow() {
  const { colors } = usePreferences();
  const aui = useAui();
  const editing = useEditing();
  const { markContinued } = useContinuedReplies();
  const isLast = useAuiState((s) => s.message.isLast);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const messageId = useAuiState((s) => s.message.id);
  const index = useAuiState((s) => s.thread.messages.findIndex((message) => message.id === s.message.id));
  const questionId = useAuiState((s) => (index > 0 ? (s.thread.messages[index - 1]?.id ?? null) : null));

  const discard = () => {
    if (!questionId) return;
    aui.thread().message({ index: index - 1 }).composer().beginEdit();
    editing.start(questionId);
  };

  return (
    <View style={styles.stoppedRow}>
      <View style={[styles.stopped, { borderColor: colors.border }]}>
        <Square size={9} color={colors.muted} fill={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>Stopped by you</Text>
      </View>
      {isLast && !isRunning ? (
        <View style={styles.stoppedActions}>
          <Pressable onPress={discard} disabled={!questionId} accessibilityRole="button" style={styles.stoppedButton}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>Discard</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!questionId) return;
              markContinued(messageId);
              aui.thread().startRun({ parentId: questionId, runConfig: { custom: { continueMessageId: messageId } } });
            }}
            disabled={!questionId}
            accessibilityRole="button"
            style={[styles.stoppedButton, styles.continueButton, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: colors.accentText, fontSize: 13, fontWeight: "600" }}>Continue</Text>
            <ArrowRight size={14} color={colors.accentText} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/**
 * "‹ 2/3 ›" under a message that has other versions: an edited message, or a regenerated reply. The web shows the same
 * control (services/web/src/components/chat/branch-picker.tsx). Switching does nothing while a reply runs.
 */
function VersionPicker() {
  const { colors } = usePreferences();
  const isUser = useAuiState((s) => s.message.role === "user");
  const branchCount = useAuiState((s) => s.message.branchCount);
  if (branchCount < 2) return null;
  return (
    <View style={[styles.picker, isUser ? styles.pickerUser : null]}>
      <BranchPickerPrimitive.Previous style={styles.pickerButton} hitSlop={8} accessibilityLabel="Previous version">
        <ChevronLeft size={16} color={colors.muted} />
      </BranchPickerPrimitive.Previous>
      <Text style={[styles.pickerCount, { color: colors.muted }]}>
        <BranchPickerPrimitive.Number />/<BranchPickerPrimitive.Count />
      </Text>
      <BranchPickerPrimitive.Next style={styles.pickerButton} hitSlop={8} accessibilityLabel="Next version">
        <ChevronRight size={16} color={colors.muted} />
      </BranchPickerPrimitive.Next>
    </View>
  );
}

/** The options of one message, in a bottom sheet. Tap outside to close it. */
function MessageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = usePreferences();
  const aui = useAui();
  const editing = useEditing();
  const messageId = useAuiState((s) => s.message.id);
  const isUser = useAuiState((s) => s.message.role === "user");
  // Edit: the composer takes the message's text and files (the message's edit composer), until it is sent or dropped.
  const edit = () => {
    onClose();
    aui.composer().beginEdit();
    editing.start(messageId);
  };
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
      {isUser ? (
        <Pressable onPress={edit} style={styles.option} android_ripple={{ color: colors.border }} accessibilityRole="button">
          <View style={styles.optionLead}>
            <Pencil size={18} color={colors.text} />
            <Text style={[styles.optionText, { color: colors.text }]}>Edit</Text>
          </View>
        </Pressable>
      ) : (
        // A new reply beside this one. Disabled while a reply runs.
        <ActionBarPrimitive.Reload style={styles.option} android_ripple={{ color: colors.border }} onPressOut={onClose}>
          {({ disabled }) => (
            <View style={[styles.optionLead, disabled && { opacity: 0.4 }]}>
              <RefreshCw size={18} color={colors.text} />
              <Text style={[styles.optionText, { color: colors.text }]}>Regenerate</Text>
            </View>
          )}
        </ActionBarPrimitive.Reload>
      )}
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
  stoppedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stoppedActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 },
  stoppedButton: { height: 30, paddingHorizontal: 12, borderRadius: 15, flexDirection: "row", alignItems: "center", gap: 4 },
  continueButton: { paddingRight: 10 },
  stopped: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  userBubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  editingLabel: { fontSize: 12, fontWeight: "600", marginBottom: -2 },
  picker: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: -4 },
  pickerUser: { alignSelf: "flex-end" },
  pickerButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  pickerCount: { fontSize: 12, fontVariant: ["tabular-nums"], minWidth: 28, textAlign: "center" },
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
