import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, ChevronDown, X } from "lucide-react-native";
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
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.row}
      >
        <View style={styles.status}>
          {running ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : failed ? (
            <X size={14} color={colors.danger} />
          ) : (
            <Check size={14} color={colors.muted} />
          )}
        </View>
        <Text numberOfLines={open ? undefined : 1} style={[styles.label, { color: colors.muted }]}>
          {labelOf(part, !running)}
        </Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={14} color={colors.muted} />
        </View>
      </Pressable>
      {open ? (
        <View style={[styles.details, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {command ? (
            <Text selectable style={[styles.code, { color: colors.text }]}>
              {clip(command)}
            </Text>
          ) : null}
          {result ? (
            <Text selectable style={[styles.code, { color: failed ? colors.danger : colors.muted }]}>
              {clip(result)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  status: { width: 16, alignItems: "center" },
  label: { flex: 1, fontSize: 14 },
  details: { marginTop: 6, marginLeft: 24, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, gap: 8 },
  code: { fontFamily: "monospace", fontSize: 12 },
});
