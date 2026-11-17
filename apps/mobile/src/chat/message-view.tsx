import { ActionBarPrimitive, BranchPickerPrimitive, MessagePrimitive, useAuiState } from "@assistant-ui/react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Row, RNHostView, Text } from "@expo/ui";
import { ActionSheet } from "@/components/action-sheet";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
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
    <MessagePrimitive.Root style={{ alignItems: isUser ? "flex-end" : "stretch" }}>
      {files.length > 0 ? (
        <View style={{ alignItems: "flex-end" }}>
          {files.some(isImageFile) ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
        style={isUser ? { backgroundColor: colors.user } : undefined}
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
  return (
    <M3Host matchContents>
      <Row alignment="center">
        <Glyph name="stop" />
        <Text>Stopped by you</Text>
      </Row>
    </M3Host>
  );
}

/**
 * The options of one message, in a bottom sheet. Tap outside to close it. The assistant-ui action primitives are React
 * Native touch targets: each one sits in an RNHostView, and its label is @expo/ui.
 */
function MessageSheet({ visible, onClose, isUser }: { visible: boolean; onClose: () => void; isUser: boolean }) {
  return (
    <ActionSheet visible={visible} onClose={onClose}>
      <RNHostView matchContents>
        <ActionBarPrimitive.Copy>
          {({ isCopied }) => (
            <M3Host matchContents>
              <Text>{isCopied ? "Copied" : "Copy"}</Text>
            </M3Host>
          )}
        </ActionBarPrimitive.Copy>
      </RNHostView>
      {isUser ? null : (
        <>
          <RNHostView matchContents>
            <ActionBarPrimitive.Reload>
              <M3Host matchContents>
                <Text>Regenerate</Text>
              </M3Host>
            </ActionBarPrimitive.Reload>
          </RNHostView>
          <RNHostView matchContents>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <BranchPickerPrimitive.Previous>
                <M3Host matchContents>
                  <Text>‹ Previous</Text>
                </M3Host>
              </BranchPickerPrimitive.Previous>
              <BranchPickerPrimitive.Number />
              <BranchPickerPrimitive.Next>
                <M3Host matchContents>
                  <Text>Next ›</Text>
                </M3Host>
              </BranchPickerPrimitive.Next>
            </View>
          </RNHostView>
        </>
      )}
    </ActionSheet>
  );
}
