import { useAuiState } from "@assistant-ui/react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Text } from "react-native";
import { usePreferences } from "@/preferences";
import { RunActivity, type ActivityEntry } from "./activity/run-activity";
import { FilePart, ImagePart } from "./parts/file-part";
import { ReasoningPart } from "./parts/reasoning-part";
import { TextPart } from "./parts/text-part";
import { ToolPart } from "./parts/tool-part";

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

type TurnTiming = { startedAt: number; endedAt?: number };

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

  const lastTool = parts.map((part) => part.type).lastIndexOf("tool-call");
  if (lastTool < 0) return <>{parts.map((part, index) => renderPart(part, "assistant", index))}</>;

  // The answer starts at the first text after the last tool step. Everything before it, thinking included, is the work:
  // the thinking that comes after the last tool belongs to the activity, not to the answer.
  const answerStart = parts.findIndex((part, index) => index > lastTool && part.type === "text" && (part.text ?? "").trim() !== "");
  const answered = answerStart >= 0;
  const work = parts.slice(0, answered ? answerStart : parts.length);
  const answer = answered ? parts.slice(answerStart) : [];

  return (
    <>
      <ActivityGroup parts={work} running={running && !answered} messageRunning={running} timing={timing} answered={answered} />
      {answer.map((part, index) => renderPart(part, "assistant", answerStart + index))}
    </>
  );
}

/** The work of a reply in one RunActivity, with a live clock while it runs ("Working 5s"). */
function ActivityGroup({
  parts,
  running,
  messageRunning,
  timing,
  answered,
}: {
  parts: Part[];
  running: boolean;
  messageRunning: boolean;
  timing?: TurnTiming;
  answered: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!messageRunning) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [messageRunning]);

  const end = timing?.endedAt ?? (messageRunning ? now : undefined);
  const durationMs = timing && end !== undefined ? end - timing.startedAt : undefined;

  const entries: ActivityEntry[] = parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => (part.type === "text" ? (part.text ?? "").trim() !== "" : part.type === "reasoning" || part.type === "tool-call"))
    .map(({ part, index }) => ({ id: `${index}`, content: renderPart(part, "assistant", index, running) }));

  return (
    <RunActivity
      statusLabel={running ? "Working" : "Worked for"}
      durationLabel={durationMs === undefined ? undefined : formatDuration(durationMs)}
      latest={latestLabel(parts)}
      running={running}
      entries={entries}
    />
  );
}

/** The step shown under the collapsed line while the work runs: the last tool's description, or the last narration. */
function latestLabel(parts: Part[]): string | undefined {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) continue;
    if (part.type === "tool-call") {
      const args = (part.args ?? {}) as Record<string, unknown>;
      return typeof args.description === "string" && args.description.trim() ? args.description.trim() : `Ran ${part.toolName ?? "tool"}`;
    }
    if (part.type === "text" && (part.text ?? "").trim()) return (part.text ?? "").trim().split("\n")[0];
  }
  return undefined;
}

/** A user's typed text, in the bubble's colour. */
function UserText({ text }: { text: string }) {
  const { colors } = usePreferences();
  return <Text style={{ color: colors.onUser, fontSize: 16, lineHeight: 22 }}>{text}</Text>;
}

/** "5s", or "5m 32s" from a duration in milliseconds. */
function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * Renders one part. A plain function, called in loops: it must not call hooks itself (the number of parts changes while
 * a reply streams). Anything that needs the theme is a component, such as UserText.
 */
function renderPart(part: Part, role: "user" | "assistant", key: number, live = false): ReactNode {
  switch (part.type) {
    case "text":
      if (!part.text?.trim()) return null;
      return role === "user" ? <UserText key={key} text={part.text} /> : <TextPart key={key} text={part.text} />;
    case "reasoning":
      return <ReasoningPart key={key} text={part.text ?? ""} live={live} />;
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
