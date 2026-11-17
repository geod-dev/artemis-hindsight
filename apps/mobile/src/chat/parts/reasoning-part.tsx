import { Row, Text } from "@expo/ui";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { thinkingText, useElapsed } from "./thinking-label";

/**
 * The model's thinking, as one step of the activity: "Thinking 3s" while it runs, "Thought for 4s" once it has ended (the
 * web app's words). A tap opens the text; the chevron shows it can open.
 */
export function ReasoningPart({
  text,
  live = false,
  startedAt,
  endedAt,
}: {
  text: string;
  live?: boolean;
  startedAt?: number;
  endedAt?: number;
}) {
  const [open, setOpen] = useState(false);
  const elapsed = useElapsed(startedAt, live);
  const durationMs = startedAt !== undefined && endedAt !== undefined ? endedAt - startedAt : undefined;
  const hasText = text.trim() !== "";
  return (
    <View>
      <Pressable
        onPress={() => hasText && setOpen((value) => !value)}
        disabled={!hasText}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: !hasText }}
      >
        <M3Host matchContents={{ vertical: true }}>
          <Row alignment="center">
            <Text>{thinkingText(live ? elapsed : durationMs, live)}</Text>
            {hasText ? <Glyph name={open ? "chevronDown" : "chevronRight"} /> : null}
          </Row>
        </M3Host>
      </Pressable>
      {open ? (
        <M3Host matchContents={{ vertical: true }}>
          <Text>{text}</Text>
        </M3Host>
      ) : null}
    </View>
  );
}
