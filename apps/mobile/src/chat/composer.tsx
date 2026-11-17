import { AttachmentPrimitive, ComposerPrimitive, useAui, useAuiState } from "@assistant-ui/react-native";
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { ArrowUp, Mic, Plus, Square, X, type LucideIcon } from "lucide-react-native";
import { fileKind } from "@/lib/file-icons";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Alert, Animated, Image, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, apiFetch, apiUpload } from "@/lib/api";
import { MAX_ATTACHMENT_MB, type PickedFile } from "./attachment-adapter";
import { usePreferences } from "@/preferences";

const ICON_SIZE = 18;
const BARS = Array.from({ length: 14 }, (_, i) => i);

// The same wave as the web composer's voice bar (services/web/src/components/assistant-ui/elements/composer.tsx).
function barHeight(bar: number, tick: number): number {
  return 5 + Math.abs(Math.sin(bar * 1.35 + tick * 0.55)) * 13;
}

type Voice = "idle" | "recording" | "transcribing";

/**
 * The composer's surface, also used by the jump-to-latest button. In light mode the surface is the page's white, so the
 * composer gets the soft grey the web composer has (its muted tone over the page); dark mode keeps the card colour.
 */
export function composerSurface(colors: { surface: string; surfaceStrong: string }, isDark: boolean): string {
  return isDark ? colors.surface : colors.surfaceStrong;
}

/**
 * The message composer, laid out like the web composer: a rounded card with the input full width, and a toolbar underneath
 * (attach and dictate on the left, send or stop on the right). While dictating, the input is replaced by the voice bar, as
 * on the web: animated waves and a timer while recording, "Transcribing" while the server answers. The transcript is
 * added to the input. The chat moves it with the keyboard (thread-view.tsx). Icons are lucide, the same set as the web app.
 */
export function Composer({ conversationId }: { conversationId: string }) {
  const { colors, isDark } = usePreferences();
  const aui = useAui();
  const running = useAuiState((s) => s.thread.isRunning);
  const text = useAuiState((s) => s.composer.text);
  // Images sit inline, other files one per line, so the two are counted apart.
  const imageCount = useAuiState((s) => s.composer.attachments.filter((attachment) => attachment.type === "image").length);
  const fileCount = useAuiState((s) => s.composer.attachments.filter((attachment) => attachment.type !== "image").length);
  const canSend = text.trim().length > 0 || imageCount + fileCount > 0;
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [voice, setVoice] = useState<Voice>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Several files at once; each one is checked on its own, so one too large does not stop the others.
  const addFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    for (const asset of result.assets) {
      if ((asset.size ?? 0) > MAX_ATTACHMENT_MB * 1024 * 1024) {
        Alert.alert("File too large", `${asset.name} is larger than ${MAX_ATTACHMENT_MB} MB.`);
        continue;
      }
      const picked: PickedFile = { uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/octet-stream", size: asset.size };
      try {
        await aui.composer().addAttachment(picked as unknown as File);
      } catch (cause) {
        Alert.alert("Attachment rejected", cause instanceof Error ? cause.message : "This file cannot be added.");
      }
    }
  };

  const stop = () => {
    // The turn runs on the server: stopping asks it to stop, and the local stream is cancelled at once.
    void apiFetch(`/api/chat/${conversationId}/stop`, { method: "POST" }).catch(() => undefined);
    aui.thread().cancelRun();
  };

  const startVoice = async () => {
    setVoiceError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setVoiceError("Allow microphone access in your phone settings to dictate.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setVoice("recording");
  };

  // Stops the recording, sends it to the server, and adds the transcript to the input.
  const finishVoice = async () => {
    setVoice("transcribing");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("The recording was not saved.");
      const { text: transcript } = await apiUpload<{ text: string }>("/api/transcribe", "audio", {
        uri,
        name: "dictation.m4a",
        type: "audio/mp4",
      });
      const dictated = transcript.trim();
      if (dictated) aui.composer().setText(joinText(text, dictated));
    } catch (cause) {
      setVoiceError(cause instanceof ApiError ? cause.message : "Could not transcribe. Check the connection and try again.");
    } finally {
      setVoice("idle");
    }
  };

  const cancelVoice = async () => {
    await recorder.stop().catch(() => undefined);
    setVoice("idle");
  };

  return (
    <View>
      <View style={styles.wrapper}>
        <ComposerPrimitive.Root style={[styles.card, { backgroundColor: composerSurface(colors, isDark), borderColor: colors.border }]}>
          {/* Attachments side by side, wrapping onto a new row: square image previews sit inline. */}
          {imageCount > 0 ? (
            <View style={styles.imageRow}>
              <ComposerPrimitive.Attachments>{() => <AttachmentChip kind="image" />}</ComposerPrimitive.Attachments>
            </View>
          ) : null}
          {fileCount > 0 ? (
            <View style={styles.fileList}>
              <ComposerPrimitive.Attachments>{() => <AttachmentChip kind="file" />}</ComposerPrimitive.Attachments>
            </View>
          ) : null}

          {voice === "idle" ? (
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={(value) => aui.composer().setText(value)}
              placeholder="Message Artemis"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, { color: colors.text }]}
            />
          ) : (
            <VoiceBar voice={voice} seconds={Math.floor((recorderState.durationMillis ?? 0) / 1000)} />
          )}

          <View style={styles.toolbar}>
            {voice === "idle" ? (
              <View style={styles.toolbarGroup}>
                <IconButton icon={Plus} label="Add files" onPress={() => void addFiles()} />
                <IconButton icon={Mic} label="Dictate" onPress={() => void startVoice()} />
              </View>
            ) : (
              <View style={styles.toolbarGroup}>
                <IconButton icon={X} label="Cancel dictation" onPress={() => void cancelVoice()} disabled={voice === "transcribing"} />
              </View>
            )}

            {voice === "recording" ? (
              <Pressable
                onPress={() => void finishVoice()}
                accessibilityRole="button"
                accessibilityLabel="Stop dictation"
                style={[styles.send, { backgroundColor: colors.text }]}
              >
                <Square size={12} color={colors.background} fill={colors.background} />
              </Pressable>
            ) : voice === "transcribing" ? (
              <View style={[styles.send, { backgroundColor: colors.surfaceStrong }]} />
            ) : running ? (
              <Pressable
                onPress={stop}
                accessibilityRole="button"
                accessibilityLabel="Stop generating"
                style={[styles.send, { backgroundColor: colors.text }]}
              >
                <Square size={12} color={colors.background} fill={colors.background} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  // Sending closes the keyboard: the reply is read, not typed into.
                  Keyboard.dismiss();
                  aui.composer().send();
                }}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                // The web's send button: the primary colour, dimmed (half opacity) while there is nothing to send.
                style={[styles.send, { backgroundColor: colors.accent, opacity: canSend ? 1 : 0.5 }]}
              >
                <ArrowUp size={ICON_SIZE} color={colors.accentText} />
              </Pressable>
            )}
          </View>
        </ComposerPrimitive.Root>

        {voiceError ? <Text style={[styles.error, { color: colors.danger }]}>{voiceError}</Text> : null}
      </View>
    </View>
  );
}

function joinText(current: string, addition: string): string {
  if (!current.trim()) return addition;
  return `${current.trimEnd()} ${addition}`;
}

/** The voice bar: a pulsing dot, 14 waves and a timer while recording; "Transcribing" with a pulse while it runs. */
function VoiceBar({ voice, seconds }: { voice: Voice; seconds: number }) {
  const { colors } = usePreferences();
  const [tick, setTick] = useState(0);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (voice !== "recording") return undefined;
    const id = setInterval(() => setTick((value) => value + 1), 100);
    return () => clearInterval(id);
  }, [voice]);

  useEffect(() => {
    if (voice === "idle") return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [voice, pulse]);

  if (voice === "transcribing") {
    return (
      <View style={styles.voiceRow}>
        <Animated.Text style={[styles.transcribing, { color: colors.muted, opacity: pulse }]}>Transcribing</Animated.Text>
      </View>
    );
  }

  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return (
    <View style={styles.voiceRow}>
      <View style={[styles.recDot, { backgroundColor: colors.danger }]} />
      <View style={styles.bars}>
        {BARS.map((bar) => (
          <View
            key={bar}
            style={{ width: 2, borderRadius: 1, height: barHeight(bar, tick), backgroundColor: colors.text, opacity: 0.5 }}
          />
        ))}
      </View>
      <Text style={[styles.timer, { color: colors.muted }]}>
        {minutes}:{rest}
      </Text>
    </View>
  );
}

/**
 * One attachment above the input. An image shows its picture; another file shows an icon and its name. When the send
 * failed, the reason is shown under it (the attachment stays, so it can be removed or sent again).
 */
function AttachmentChip({ kind }: { kind: "image" | "file" }) {
  const { colors } = usePreferences();
  const name = useAuiState((s) => s.attachment.name);
  const type = useAuiState((s) => s.attachment.type);
  const file = useAuiState((s) => s.attachment.file);
  const status = useAuiState((s) => s.attachment.status);
  const failure = status.type === "incomplete" ? (status.message ?? "The file could not be sent.") : null;
  const uri = (file as unknown as { uri?: string } | undefined)?.uri;

  const isImage = type === "image" && Boolean(uri);
  // Each attachment renders in the container of its kind only.
  if (isImage !== (kind === "image")) return null;

  if (isImage) {
    return (
      <View style={styles.failureGroup}>
        <AttachmentPrimitive.Root style={styles.preview}>
          <Image source={{ uri }} accessibilityLabel={name} style={styles.previewImage} />
          <AttachmentPrimitive.Remove accessibilityLabel={`Remove ${name ?? "image"}`} style={[styles.previewRemove, { backgroundColor: colors.background }]}>
            <X size={14} color={colors.text} />
          </AttachmentPrimitive.Remove>
        </AttachmentPrimitive.Root>
        {failure ? <Text style={[styles.failure, { color: colors.danger }]}>{failure}</Text> : null}
      </View>
    );
  }

  const { Icon, tint } = fileKind(name);
  return (
    <View style={styles.failureGroup}>
      <AttachmentPrimitive.Root style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[styles.chipIcon, { backgroundColor: tint ? `${tint}26` : colors.surfaceStrong }]}>
          <Icon size={16} color={tint ?? colors.muted} />
        </View>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "500", maxWidth: 160 }}>
          {name}
        </Text>
        <AttachmentPrimitive.Remove accessibilityLabel={`Remove ${name ?? "file"}`} style={styles.chipRemove}>
          <X size={14} color={colors.muted} />
        </AttachmentPrimitive.Remove>
      </AttachmentPrimitive.Root>
      {failure ? <Text style={[styles.failure, { color: colors.danger }]}>{failure}</Text> : null}
    </View>
  );
}

function IconButton({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = usePreferences();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, disabled && { opacity: 0.35 }]}
    >
      <Icon size={ICON_SIZE} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8, gap: 6 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fileList: { gap: 6 },
  input: { minHeight: 44, maxHeight: 160, fontSize: 16, lineHeight: 22, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 6, textAlignVertical: "top" },
  voiceRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  bars: { flex: 1, height: 24, flexDirection: "row", alignItems: "center", gap: 3 },
  timer: { fontFamily: "monospace", fontSize: 13, fontVariant: ["tabular-nums"] },
  transcribing: { fontSize: 14 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toolbarGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 13, paddingHorizontal: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingLeft: 6, paddingRight: 8, paddingVertical: 6 },
  chipIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  chipRemove: { paddingLeft: 4, paddingVertical: 2 },
  failureGroup: { alignSelf: "flex-start", gap: 4 },
  failure: { fontSize: 12, paddingHorizontal: 4 },
  preview: { width: 64, height: 64, borderRadius: 12, overflow: "hidden" },
  previewImage: { width: 64, height: 64 },
  previewRemove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
