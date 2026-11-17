import { useState } from "react";
import { ActivityIndicator, Pressable, Text as RNText, View } from "react-native";
import { Row, RNHostView, Text } from "@expo/ui";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { usePreferences } from "@/preferences";
import { baseName } from "@/lib/sandbox-files";

interface ToolCall {
  toolName: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
  status?: { type: string };
}

// The file tools read like the web activity line: "Reading notes.md", "Written report.md", ...
const FILE_VERBS: Record<string, { running: string; done: string }> = {
  read: { running: "Reading", done: "Read" },
  write: { running: "Writing", done: "Written" },
  edit: { running: "Editing", done: "Edited" },
};

/** The step's line: the description the model gave, or the file it works on for the file tools. */
function labelOf(call: ToolCall, finished: boolean): string {
  const args = (call.args ?? {}) as Record<string, unknown>;
  const verbs = FILE_VERBS[call.toolName];
  if (verbs && typeof args.path === "string") return `${finished ? verbs.done : verbs.running} ${baseName(args.path)}`;
  if (typeof args.description === "string" && args.description.trim()) return args.description.trim();
  return `Ran ${call.toolName}`;
}

/** Bash results are { stdout, stderr, exitCode }: shown as a terminal transcript. Anything else as JSON. */
function formatResult(result: unknown): string {
  if (result === undefined || result === null) return "";
  if (typeof result === "string") return result;
  const record = result as Record<string, unknown>;
  if ("stdout" in record || "stderr" in record || "exitCode" in record) {
    const stdout = typeof record.stdout === "string" ? record.stdout.trimEnd() : "";
    const stderr = typeof record.stderr === "string" ? record.stderr.trimEnd() : "";
    const exit = record.exitCode === null || record.exitCode === undefined ? "" : `exit ${String(record.exitCode)}`;
    return [stdout, stderr && `[stderr]\n${stderr}`, exit].filter(Boolean).join("\n");
  }
  try {
    return JSON.stringify(result, null, 2) ?? "";
  } catch {
    return "";
  }
}

function clip(text: string): string {
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
}

/** One step of the agent's work. Its line is quiet; a tap shows the command and the result. */
export function ToolPart({ part }: { part: ToolCall }) {
  const { colors } = usePreferences();
  const [open, setOpen] = useState(false);
  const running = part.status?.type === "running" || part.status?.type === "requires-action";
  const failed = part.isError === true;
  const command = part.args === undefined ? "" : typeof part.args === "string" ? part.args : (() => {
    const args = part.args as Record<string, unknown>;
    return typeof args.command === "string" ? args.command : JSON.stringify(args, null, 2);
  })();
  const result = formatResult(part.result);

  return (
    <View>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <M3Host matchContents={{ vertical: true }}>
          <Row alignment="center">
            {running ? (
              <RNHostView matchContents>
                <ActivityIndicator size="small" color={colors.muted} />
              </RNHostView>
            ) : failed ? (
              <Glyph name="close" color={colors.danger} />
            ) : (
              <Glyph name="check" color={colors.muted} />
            )}
            <Text>{labelOf(part, !running)}</Text>
            <Glyph name={open ? "chevronDown" : "chevronRight"} />
          </Row>
        </M3Host>
      </Pressable>
      {open ? (
        <>
          {command ? <RNText selectable style={{ fontFamily: "monospace", color: colors.text }}>{clip(command)}</RNText> : null}
          {result ? (
            <RNText selectable style={{ fontFamily: "monospace", color: failed ? colors.danger : colors.muted }}>
              {clip(result)}
            </RNText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
