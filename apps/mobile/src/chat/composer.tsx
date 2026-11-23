import { AttachmentPrimitive, ComposerPrimitive, useAui, useAuiState } from "@assistant-ui/react-native";
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { ArrowUp, Mic, Plus, Square, X, type LucideIcon } from "lucide-react-native";
import { fileKind } from "@/lib/file-icons";
import { forwardRef, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Alert, Image, Keyboard, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { ApiError, apiFetch, apiUpload } from "@/lib/api";
import { MAX_ATTACHMENT_MB, type PickedFile } from "./attachment-adapter";
import { useContinuedReplies } from "./continued-replies";
import { usePreferences } from "@/preferences";
import { acquireSwipeLock } from "@/lib/swipe-lock";

const ICON_SIZE = 18;
// The room the send button takes when it is in: the 36 px button and the 8 px gap before it.
const SEND_SLOT = 44;
// The button under a held finger zooms by 75% (scale 1.75) and rises by 120% of its 36 px size, on a spring that overshoots.
const LIFT_SCALE = 1 + 0.75;
const LIFT_PX = 36 * 1.2;
// A press shorter than this is a click: dictation keeps going after the finger lifts. Longer, it is push-to-talk.
const HOLD_MS = 250;
// The live waveform: one sample per tick, one 2 px bar per sample with a 2 px gap between bars.
const SAMPLE_MS = 60;
const BAR_STEP = 4;
const MAX_SAMPLES = 1000;
// How far outside a button the finger still counts as on it.
const HIT_SLOP = 4;

type ViewRef = ComponentRef<typeof View>;
type Voice = "idle" | "recording" | "transcribing";
/** The three buttons a held finger can end on while dictating. */
type Target = "cancel" | "stop" | "send";
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** One press on the dictate button, from the finger going down until it lifts. */
interface Press {
  x: number;
  y: number;
  /** Held past HOLD_MS: the release decides the action. */
  held: boolean;
  /** The press started while already recording: a tap on the stop button. */
  onStop: boolean;
  hover: Target | null;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * The composer's surface, also used by the jump-to-latest button. In light mode the surface is the page's white, so the
 * composer gets the soft grey the web composer has (its muted tone over the page); dark mode keeps the card colour.
 */
export function composerSurface(colors: { surface: string; surfaceStrong: string }, isDark: boolean): string {
  return isDark ? colors.surface : colors.surfaceStrong;
}

/**
 * The message composer, laid out like the web composer: a rounded card with the input full width, and a toolbar underneath.
 * Attach on the left; dictate and send on the right. While dictating, the card turns inverted (its text colour becomes the
 * surface) and the toolbar reads: cancel (left), the live waveform, stop (transcribe into the input), send (transcribe and
 * send). Pressing the dictate button starts dictation at once. A tap leaves it running. Holding it dictates while the finger
 * is down: sliding onto cancel, stop or send buzzes and enlarges that button, and lifting there does its action. Lifting
 * anywhere else stops, as the stop button does. Icons are lucide, the same set as the web app.
 *
 * Editing a message happens here too (`editing`): the composer is then in the message's scope (EditingScope), so it holds
 * the message's text and files, and sending makes the edited version. The card sits in a tinted container of the same
 * radius whose top holds "Editing message" and a close button: the card looks laid over it. Without an edit the container
 * is transparent and takes no room. While a reply runs, the stop button stays where send is: an edit is sent once the
 * reply has ended or been stopped.
 */
export function Composer({ conversationId, editing = false }: { conversationId: string; editing?: boolean }) {
  const { colors, isDark } = usePreferences();
  const aui = useAui();
  const running = useAuiState((s) => s.thread.isRunning);
  const { markStopped } = useContinuedReplies();
  // The reply the stop button stops: a continued reply counts as stopped again (see continued-replies.tsx).
  const lastId = useAuiState((s) => s.thread.messages.at(-1)?.id);
  const text = useAuiState((s) => s.composer.text);
  // Images sit inline, other files one per line, so the two are counted apart.
  const imageCount = useAuiState((s) => s.composer.attachments.filter((attachment) => attachment.type === "image").length);
  const fileCount = useAuiState((s) => s.composer.attachments.filter((attachment) => attachment.type !== "image").length);
  const canSend = text.trim().length > 0 || imageCount + fileCount > 0;
  // The send button is shown while there is something to send (or a reply runs, when it is the stop button). Until then it
  // takes no room: the dictate button is the one at the end of the bar, on the accent disc.
  const sendShown = canSend || running;
  // 0 = no send button (the dictate button is the accent disc), 1 = the send button is in (the dictate button is transparent).
  const sendProgress = useSharedValue(sendShown ? 1 : 0);
  useEffect(() => {
    sendProgress.value = withTiming(sendShown ? 1 : 0, { duration: 220 });
  }, [sendShown, sendProgress]);
  const dictateStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sendProgress.value, [0, 1], [colors.accent, "rgba(0,0,0,0)"]),
  }));
  // The send slot grows from the right edge: its width pushes the dictate button to the left.
  const sendSlotStyle = useAnimatedStyle(() => ({ width: sendProgress.value * SEND_SLOT }));
  const sendInnerStyle = useAnimatedStyle(() => ({
    opacity: sendProgress.value,
    transform: [{ translateX: (1 - sendProgress.value) * SEND_SLOT }],
  }));
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Set by "send dictated message": the send happens after the transcript is in the input (see finishVoice).
  const sendAfter = useRef(false);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [voice, setVoice] = useState<Voice>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // The button the held finger is over: it is shown enlarged, and the finger buzzes when it arrives.
  const [hover, setHover] = useState<Target | null>(null);
  const press = useRef<Press | null>(null);
  // The action of a press that lifted before the recording had started (the microphone permission dialog).
  const pendingEnd = useRef<{ target: Target | null } | null>(null);
  const targetRects = useRef<Partial<Record<Target, Rect>>>({});
  const cancelRef = useRef<ViewRef>(null);
  const stopRef = useRef<ViewRef>(null);
  const sendRef = useRef<ViewRef>(null);
  const inverted = voice !== "idle";
  // Icons on the inverted card take the surface colour; on the normal card they are muted, as before.
  const tone = inverted ? colors.accentText : colors.muted;

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
    markStopped(lastId);
    // The turn runs on the server: stopping asks it to stop, and the local stream is cancelled at once.
    void apiFetch(`/api/chat/${conversationId}/stop`, { method: "POST" }).catch(() => undefined);
    aui.thread().cancelRun();
  };

  const startVoice = async () => {
    setVoiceError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        pendingEnd.current = null;
        setVoiceError("Allow microphone access in your phone settings to dictate.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoice("recording");
    } catch (cause) {
      pendingEnd.current = null;
      setVoiceError(cause instanceof Error ? cause.message : "Could not start dictation.");
    }
  };

  // Stops the recording, sends it to the server, and adds the transcript to the input. With `andSend` the message is
  // sent once the transcript is in (the web's "send dictated message"): see the effect below.
  const finishVoice = async (andSend: boolean) => {
    sendAfter.current = andSend;
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
      sendAfter.current = false;
      setVoiceError(cause instanceof ApiError ? cause.message : "Could not transcribe. Check the connection and try again.");
    } finally {
      setVoice("idle");
    }
  };

  const cancelVoice = async () => {
    sendAfter.current = false;
    pendingEnd.current = null;
    await recorder.stop().catch(() => undefined);
    setVoice("idle");
  };

  // Runs the action of a button the press ended on. Anywhere else (null) it is a stop.
  const perform = (target: Target | null) => {
    if (target === "cancel") void cancelVoice();
    else if (target === "send") void finishVoice(true);
    else void finishVoice(false);
  };

  // Sends the message once dictation is over and the transcript is in the input, when the user asked for it.
  useEffect(() => {
    if (voice !== "idle" || !sendAfter.current) return;
    sendAfter.current = false;
    if (!canSend) return;
    Keyboard.dismiss();
    aui.composer().send();
  }, [voice, text, canSend, aui]);

  // The button under a held finger is selected at once: when the hold starts, and when the buttons' positions arrive. It
  // does not wait for the finger to move (the move handler keeps it up to date after that).
  const refreshHover = () => {
    const current = press.current;
    if (!current || !current.held || current.onStop) return;
    const target = hitTest(current.x, current.y);
    if (target !== current.hover) {
      current.hover = target;
      setHover(target);
    }
  };

  // Once recording, the buttons are where they are on screen: measure them for the hit test. A press that ended before
  // the recording started acts now.
  useEffect(() => {
    if (voice !== "recording") return undefined;
    const id = setTimeout(() => {
      // measureInWindow answers asynchronously, one button at a time: each answer re-checks the finger's button.
      const measure = (key: Target, node: ViewRef | null) =>
        node?.measureInWindow((x, y, width, height) => {
          targetRects.current[key] = { x, y, width, height };
          refreshHover();
        });
      measure("cancel", cancelRef.current);
      measure("stop", stopRef.current);
      measure("send", sendRef.current);
    }, 0);
    const pending = pendingEnd.current;
    pendingEnd.current = null;
    if (pending) perform(pending.target);
    return () => clearTimeout(id);
  }, [voice]);

  // Window coordinates, the same space as the measured button rectangles.
  const hitTest = (x: number, y: number): Target | null => {
    for (const key of ["cancel", "stop", "send"] as Target[]) {
      const rect = targetRects.current[key];
      if (!rect) continue;
      if (x >= rect.x - HIT_SLOP && x <= rect.x + rect.width + HIT_SLOP && y >= rect.y - HIT_SLOP && y <= rect.y + rect.height + HIT_SLOP) {
        return key;
      }
    }
    return null;
  };

  // While a dictate press is held, nothing else takes the sideways swipe: the drawer's swipe is off until the press ends.
  const swipeHold = useRef<(() => void) | null>(null);
  const holdSwipe = () => {
    swipeHold.current ??= acquireSwipeLock();
  };
  const releaseSwipe = () => {
    swipeHold.current?.();
    swipeHold.current = null;
  };
  useEffect(() => releaseSwipe, []);

  // The dictate button. A press starts dictation at once; see the Composer doc comment for the gesture.
  const onPressDown = (x: number, y: number) => {
    if (voice === "recording") {
      press.current = { x, y, held: false, onStop: true, hover: null };
      return;
    }
    const next: Press = { x, y, held: false, onStop: false, hover: null };
    next.timer = setTimeout(() => {
      if (press.current === next) {
        next.held = true;
        holdSwipe();
        refreshHover();
      }
    }, HOLD_MS);
    press.current = next;
    void startVoice();
  };

  const onPressMove = (x: number, y: number) => {
    const current = press.current;
    if (!current) return;
    current.x = x;
    current.y = y;
    if (!current.held || current.onStop) return;
    const target = hitTest(x, y);
    if (target !== current.hover) {
      current.hover = target;
      setHover(target);
      // Haptics work with the phone on silent: they are the system's touch feedback, not the ringer's vibration.
      if (target) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const onPressUp = (x: number, y: number) => {
    const current = press.current;
    press.current = null;
    releaseSwipe();
    if (!current) return;
    if (current.timer) clearTimeout(current.timer);
    setHover(null);
    if (current.onStop) {
      void finishVoice(false);
      return;
    }
    // A click: dictation keeps running until stop, cancel or send is pressed.
    if (!current.held) return;
    const target = hitTest(x, y);
    if (target) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (voice === "recording") perform(target);
    else pendingEnd.current = { target };
  };

  // The press follows the finger across the buttons: a pan from the first touch until the finger lifts. The handlers are
  // read from a ref, so the gesture always calls the latest render's handlers.
  const pressHandlers = useRef({ down: onPressDown, move: onPressMove, up: onPressUp });
  pressHandlers.current = { down: onPressDown, move: onPressMove, up: onPressUp };
  const dispatch = (kind: "down" | "move" | "up", x: number, y: number) => pressHandlers.current[kind](x, y);
  const pressGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          scheduleOnRN(dispatch, "down", event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          scheduleOnRN(dispatch, "move", event.absoluteX, event.absoluteY);
        })
        .onFinalize((event) => {
          scheduleOnRN(dispatch, "up", event.absoluteX, event.absoluteY);
        }),
    [],
  );

  // An edit starts with the keyboard open on the message's text.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <View>
      <View style={styles.wrapper}>
        <View style={[styles.editFrame, editing && { backgroundColor: editTint(colors.accent) }]}>
        {editing ? <EditingHeader /> : null}
        <ComposerPrimitive.Root
          style={[
            styles.card,
            inverted
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { backgroundColor: composerSurface(colors, isDark), borderColor: colors.border },
          ]}
        >
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

          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={(value) => aui.composer().setText(value)}
            placeholder="Message Artemis"
            placeholderTextColor={inverted ? colors.accentText : colors.muted}
            multiline
            style={[styles.input, { color: inverted ? colors.accentText : colors.text }]}
          />

          <View style={styles.toolbar}>
            <View style={styles.toolbarGroup}>
              {voice === "idle" ? (
                <IconButton icon={Plus} label="Add files" tone={tone} onPress={() => void addFiles()} />
              ) : (
                <IconButton
                  ref={cancelRef}
                  icon={X}
                  label="Cancel dictation"
                  tone={tone}
                  onPress={() => void cancelVoice()}
                  disabled={voice === "transcribing"}
                  highlighted={hover === "cancel"}
                />
              )}
            </View>

            {/* The live waveform sits between cancel and stop, as on the web. */}
            <View style={styles.middle}>
              {voice === "idle" ? null : (
                <DictationWaveform recorder={recorder} transcribing={voice === "transcribing"} tone={colors.accentText} />
              )}
            </View>

            <View style={[styles.toolbarGroup, voice !== "idle" && styles.dictatingGroup]}>
              {/* The dictate button: while dictating it is the stop button, in the same place. */}
              <GestureDetector gesture={pressGesture}>
                <Animated.View
                  accessibilityRole="button"
                  accessibilityLabel={voice === "idle" ? "Dictate" : "Stop dictation"}
                  accessibilityHint={voice === "idle" ? "Press and hold to dictate while holding" : undefined}
                  style={[styles.iconButton, voice === "idle" && dictateStyle, voice === "transcribing" && { opacity: 0.35 }]}
                >
                  <View ref={stopRef} collapsable={false} style={styles.fill}>
                    <Lift active={hover === "stop"} style={styles.fill}>
                      {voice === "idle" ? (
                        <Mic size={ICON_SIZE} color={sendShown ? colors.muted : colors.accentText} />
                      ) : (
                        <Square size={12} color={tone} fill={tone} />
                      )}
                    </Lift>
                  </View>
                </Animated.View>
              </GestureDetector>

              {voice !== "idle" ? (
                <Pressable
                  ref={sendRef}
                  onPress={() => void finishVoice(true)}
                  disabled={voice === "transcribing"}
                  accessibilityRole="button"
                  accessibilityLabel="Send dictated message"
                  // Reversed like the rest of the dictating composer: a disc in the card's text colour, with the primary arrow.
                  style={[styles.send, { opacity: voice === "transcribing" ? 0.5 : 1 }]}
                >
                  <Lift active={hover === "send"} style={[styles.send, { backgroundColor: colors.accentText }]}>
                    <ArrowUp size={ICON_SIZE} color={colors.accent} />
                  </Lift>
                </Pressable>
              ) : (
                // The stop button while a reply runs, otherwise the send button: both slide in from the right.
                <Animated.View style={[styles.sendSlot, sendSlotStyle]}>
                  <Animated.View style={[styles.sendInner, sendInnerStyle]}>
                    {running ? (
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
                        style={[styles.send, { backgroundColor: colors.accent }]}
                      >
                        <ArrowUp size={ICON_SIZE} color={colors.accentText} />
                      </Pressable>
                    )}
                  </Animated.View>
                </Animated.View>
              )}
            </View>
          </View>
        </ComposerPrimitive.Root>
        </View>

        {voiceError ? <Text style={[styles.error, { color: colors.danger }]}>{voiceError}</Text> : null}
      </View>
    </View>
  );
}

/** The tint of an edit: the accent, light. The edited message in the thread takes it too (message-view.tsx). */
export function editTint(accent: string): string {
  return /^#[0-9a-f]{6}$/i.test(accent) ? `${accent}26` : accent;
}

/**
 * The top of the edit container: "Editing message", and the close button on the other side. Closing drops the edit and
 * brings back the draft that was in the composer; when the text or the files were changed, it asks first.
 */
function EditingHeader() {
  const { colors } = usePreferences();
  const aui = useAui();
  const text = useAuiState((s) => s.composer.text);
  const attachmentIds = useAuiState((s) => s.composer.attachments.map((attachment) => attachment.id).join(","));
  // The edit as it opened: the message's text and files.
  const initial = useRef({ text, attachmentIds });
  const changed = text !== initial.current.text || attachmentIds !== initial.current.attachmentIds;

  const close = () => {
    if (!changed) {
      aui.composer().cancel();
      return;
    }
    Alert.alert("Discard your changes?", "The message stays as it was.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => aui.composer().cancel() },
    ]);
  };

  return (
    <View style={styles.editHeader}>
      <Text style={[styles.editLabel, { color: colors.accent }]}>Editing message</Text>
      <Pressable
        onPress={close}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Stop editing"
        style={styles.editClose}
      >
        <X size={16} color={colors.accent} />
      </Pressable>
    </View>
  );
}

function joinText(current: string, addition: string): string {
  if (!current.trim()) return addition;
  return `${current.trimEnd()} ${addition}`;
}

/** Microphone loudness between 0 and 1, from the recorder's level in decibels (about -60 silent, 0 loudest). */
function levelOf(decibels: number | undefined): number {
  if (decibels === undefined) return 0;
  return Math.min(1, Math.max(0, (decibels + 60) / 50));
}

/**
 * The live recording waveform: a scrolling row of microphone-level bars (the newest on the right) and the elapsed time.
 * As many bars as the space allows are drawn. `transcribing` freezes the bars and shows the label in place of the time.
 */
function DictationWaveform({
  recorder,
  transcribing,
  tone,
}: {
  recorder: ReturnType<typeof useAudioRecorder>;
  transcribing: boolean;
  tone: string;
}) {
  const { colors } = usePreferences();
  const state = useAudioRecorderState(recorder, SAMPLE_MS);
  const [slots, setSlots] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const [samples, setSamples] = useState<number[]>([]);

  // One sample per tick while recording. Transcribing, the bars stay where they were.
  useEffect(() => {
    if (transcribing) return;
    const list = samplesRef.current;
    list.push(levelOf(state.metering));
    if (list.length > MAX_SAMPLES) list.splice(0, list.length - MAX_SAMPLES);
    setSamples(list.slice());
  }, [state.durationMillis, transcribing]);

  const visible = slots > 0 ? samples.slice(-slots) : [];
  const padded = [...Array.from({ length: Math.max(0, slots - visible.length) }, () => 0), ...visible];
  const seconds = Math.floor(state.durationMillis / 1000);
  const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <View style={[styles.waveform, transcribing && { opacity: 0.6 }]} accessibilityLabel={transcribing ? "Transcribing" : "Recording"}>
      <View style={[styles.recDot, { backgroundColor: transcribing ? tone : colors.danger }]} />
      <View
        style={styles.bars}
        onLayout={(event) => setSlots(Math.max(1, Math.floor((event.nativeEvent.layout.width + 2) / BAR_STEP)))}
      >
        {padded.map((level, index) => (
          <View
            key={index}
            style={{ width: 2, borderRadius: 1, height: `${Math.round(12 + level * 88)}%`, backgroundColor: tone, opacity: 0.7 }}
          />
        ))}
      </View>
      <Text style={[styles.timer, { color: tone }]}>{transcribing ? "Transcribing" : timer}</Text>
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

/**
 * The button under a held finger. It springs up by 120% of its size and zooms by 75%; the spring overshoots, and a short
 * squash-and-stretch wobble runs when it is picked up and again when it is let go, so the change reads as a physical bounce.
 * The first render is not animated: a button that appears does not bounce.
 */
function Lift({ active, style, children }: { active: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const progress = useSharedValue(0);
  const wobble = useSharedValue(0);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    progress.value = withSpring(active ? 1 : 0, { damping: 12, stiffness: 260, mass: 0.7 });
    // The wobble starts at 0, goes to 1 quickly, then a damped spring swings it back through 0 and past it: squash, then stretch.
    wobble.value = withSequence(withTiming(1, { duration: 70 }), withSpring(0, { damping: 5, stiffness: 320, mass: 0.6 }));
  }, [active, progress, wobble]);
  const animated = useAnimatedStyle(() => {
    const scale = 1 + (LIFT_SCALE - 1) * progress.value;
    const deform = 0.14 * wobble.value;
    return {
      transform: [
        { translateY: -LIFT_PX * progress.value },
        { scaleX: scale * (1 - deform) },
        { scaleY: scale * (1 + deform) },
      ],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

const IconButton = forwardRef<
  ViewRef,
  { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean; tone: string; highlighted?: boolean }
>(function IconButton({ icon: Icon, label, onPress, disabled, tone, highlighted }, ref) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, disabled && { opacity: 0.35 }]}
    >
      <Lift active={Boolean(highlighted)}>
        <Icon size={ICON_SIZE} color={tone} />
      </Lift>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 8 },
  // Transparent and without padding when not editing, so the card looks as it always does; the same radius as the card.
  editFrame: { borderRadius: 24 },
  editHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 16, paddingRight: 12, paddingVertical: 8 },
  editLabel: { fontSize: 13, fontWeight: "600" },
  editClose: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8, gap: 6 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fileList: { gap: 6 },
  input: { minHeight: 44, maxHeight: 160, fontSize: 16, lineHeight: 22, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 6, textAlignVertical: "top" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 6 },
  // No gap here: a gap also counts the send slot while it is empty. The dictating pair sets its own (dictatingGroup).
  toolbarGroup: { flexDirection: "row", alignItems: "center" },
  dictatingGroup: { gap: 6 },
  middle: { flex: 1, minWidth: 0 },
  waveform: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  bars: { flex: 1, minWidth: 0, height: 28, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2, overflow: "hidden" },
  timer: { fontFamily: "monospace", fontSize: 13, fontVariant: ["tabular-nums"] },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  fill: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  // The room of the send button: a slot that grows from the right edge, and the button inside it with the 8 px gap.
  sendSlot: { height: 36, overflow: "hidden", justifyContent: "center" },
  sendInner: { width: 36, marginLeft: 8 },
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
