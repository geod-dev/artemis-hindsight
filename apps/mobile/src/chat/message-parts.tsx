import { useAuiState } from "@assistant-ui/react-native";
import { createContext, useContext, type ReactNode } from "react";
import { Text } from "react-native";
import { usePreferences } from "@/preferences";
import { RunActivity, type ActivityEntry } from "./activity/run-activity";
import { FilePart, ImagePart } from "./parts/file-part";
import { ImageGenerationFrame } from "./parts/image-generation";
import { ReasoningPart } from "./parts/reasoning-part";
import { TextPart } from "./parts/text-part";
import { PendingSpinner, formatDuration, useElapsed } from "./parts/thinking-label";
import { IMAGE_TOOL, ToolPart } from "./parts/tool-part";

// The parts of a message as the runtime and the server give them: the runtime uses data/mimeType, the server's AI SDK
// shape uses url/mediaType. Both are read.
type Part = {
  type: string;
  text?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
  status?: { type: string };
  toolName?: string;
  image?: string;
  url?: string;
  data?: string;
  mediaType?: string;
  mimeType?: string;
  filename?: string;
};

type Timing = { startedAt: number; endedAt?: number };
/** The turn's timing from the server; `reasonings` has one entry per thinking block, in order. */
type TurnTiming = Timing & { reasonings?: Timing[] };

/** What a part needs from its message: whether the reply is still running, and the timing of its thinking block. */
type PartOptions = { running?: boolean; timing?: Timing };

/**
 * The parts of one message. A reply's work (thinking, tool steps, the narration between them) is one RunActivity, folded
 * like the web app; the final answer comes after it. A user's files are not drawn here: they sit above the bubble
 * (message-view.tsx).
 */
export function MessageParts({ role }: { role: "user" | "assistant" }) {
  const parts = useAuiState((s) => s.message.parts) as unknown as Part[];
  const running = useAuiState((s) => s.message.status?.type === "running");
  const timing = useAuiState((s) => (s.message.metadata as { custom?: { turnTiming?: TurnTiming } } | undefined)?.custom?.turnTiming);

  if (role === "user") return <>{parts.map((part, index) => renderPart(part, "user", index))}</>;

  // From the send until the first part of the reply arrives, only a spinner: the request is sent, the thinking has not started.
  const hasContent = parts.some(
    (part) =>
      part.type === "reasoning" ||
      part.type === "tool-call" ||
      part.type === "file" ||
      part.type === "image" ||
      (part.type === "text" && (part.text ?? "").trim() !== ""),
  );
  if (running && !hasContent) return <PendingSpinner />;

  // The n-th thinking block of the message has the n-th timing of the turn (the server counts them in stream order).
  const timingOf = (index: number): Timing | undefined => {
    let ordinal = 0;
    for (let i = 0; i < index; i += 1) if (parts[i]?.type === "reasoning") ordinal += 1;
    return timing?.reasonings?.[ordinal];
  };
  const optionsOf = (index: number): PartOptions => ({ running, timing: timingOf(index) });

  const lastTool = parts.map((part) => part.type).lastIndexOf("tool-call");
  if (lastTool < 0) return <>{parts.map((part, index) => renderPart(part, "assistant", index, optionsOf(index)))}</>;

  // The answer starts at the first text after the last tool step. Everything before it, thinking included, is the work:
  // the thinking that comes after the last tool belongs to the activity, not to the answer.
  const answerStart = parts.findIndex((part, index) => index > lastTool && part.type === "text" && (part.text ?? "").trim() !== "");
  const answered = answerStart >= 0;
  const work = parts.slice(0, answered ? answerStart : parts.length);
  const answer = answered ? parts.slice(answerStart) : [];

  return (
    <>
      <ActivityGroup parts={work} running={running && !answered} messageRunning={running} timing={timing} timingOf={timingOf} />
      {answer.map((part, index) => renderPart(part, "assistant", answerStart + index, optionsOf(answerStart + index)))}
    </>
  );
}

/**
 * The work of a reply in one RunActivity, with a live clock while it runs ("Working 5s"). Under it, each image still being
 * generated shows as a generating frame, as on the web. A stopped reply has none: its calls will never return.
 */
function ActivityGroup({
  parts,
  running,
  messageRunning,
  timing,
  timingOf,
}: {
  parts: Part[];
  running: boolean;
  messageRunning: boolean;
  timing?: TurnTiming;
  timingOf: (index: number) => Timing | undefined;
}) {
  // The clock counts from the server's start, or from when the work appeared if that is not known yet.
  const elapsed = useElapsed(timing?.startedAt, messageRunning);
  const durationMs =
    timing?.endedAt !== undefined ? timing.endedAt - timing.startedAt : messageRunning ? elapsed : undefined;

  const entries: ActivityEntry[] = parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => (part.type === "text" ? (part.text ?? "").trim() !== "" : part.type === "reasoning" || part.type === "tool-call"))
    .map(({ part, index }) => ({ id: `${index}`, content: renderPart(part, "assistant", index, { running: messageRunning, timing: timingOf(index) }) }));

  const generatingImages = messageRunning
    ? parts.flatMap((part, index) =>
        part.type === "tool-call" && part.toolName === IMAGE_TOOL && part.result === undefined ? [index] : [],
      )
    : [];

  return (
    <>
      <RunActivity
        statusLabel={running ? "Working" : "Worked for"}
        durationLabel={durationMs === undefined ? undefined : formatDuration(durationMs)}
        latest={latestLabel(parts)}
        running={running}
        entries={entries}
      />
      {generatingImages.map((index) => (
        <ImageGenerationFrame key={index} />
      ))}
    </>
  );
}

/** The step shown under the collapsed line while the work runs: the last tool's description, or the last narration. */
function latestLabel(parts: Part[]): string | undefined {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) continue;
    if (part.type === "tool-call") {
      if (part.toolName === IMAGE_TOOL) return part.result === undefined ? "Generating image" : "Generated image";
      const args = (part.args ?? {}) as Record<string, unknown>;
      return typeof args.description === "string" && args.description.trim() ? args.description.trim() : `Ran ${part.toolName ?? "tool"}`;
    }
    if (part.type === "text" && (part.text ?? "").trim()) return (part.text ?? "").trim().split("\n")[0];
  }
  return undefined;
}

/** The text colour of the bubble around a user's text, when it is not the usual one (the message being edited). */
export const UserTextColorContext = createContext<string | undefined>(undefined);

/** A user's typed text, in the bubble's colour. */
function UserText({ text }: { text: string }) {
  const { colors } = usePreferences();
  const color = useContext(UserTextColorContext) ?? colors.onUser;
  return <Text style={{ color, fontSize: 16, lineHeight: 22 }}>{text}</Text>;
}

/**
 * Renders one part. A plain function, called in loops: it must not call hooks itself (the number of parts changes while
 * a reply streams). Anything that needs the theme or a clock is a component, such as UserText or ReasoningPart.
 */
function renderPart(part: Part, role: "user" | "assistant", key: number, options: PartOptions = {}): ReactNode {
  switch (part.type) {
    case "text":
      if (!part.text?.trim()) return null;
      return role === "user" ? <UserText key={key} text={part.text} /> : <TextPart key={key} text={part.text} />;
    case "reasoning":
      // Live while the reply runs and the block has not ended.
      return (
        <ReasoningPart
          key={key}
          live={Boolean(options.running) && options.timing?.endedAt === undefined}
          startedAt={options.timing?.startedAt}
          endedAt={options.timing?.endedAt}
        />
      );
    case "tool-call":
      return <ToolPart key={key} part={part as Parameters<typeof ToolPart>[0]["part"]} />;
    case "image":
      return role === "user" ? null : <ImagePart key={key} url={part.image ?? ""} />;
    case "file": {
      if (role === "user") return null;
      return <FilePart key={key} url={part.url ?? part.data ?? ""} filename={part.filename} mimeType={part.mediaType ?? part.mimeType} />;
    }
    default:
      return null;
  }
}
