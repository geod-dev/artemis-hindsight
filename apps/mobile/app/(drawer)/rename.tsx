import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { BackButton } from "@/components/back-button";
import { ApiError } from "@/lib/api";
import { useRenameConversation } from "@/queries/conversations";
import { usePreferences } from "@/preferences";

// Same limit as the server (PATCH /api/conversations/[id]) and the web's rename dialog
// (services/web/src/components/conversations/rename-conversation-dialog.tsx).
const TITLE_MAX = 120;

/**
 * "Type a name" from a conversation's menu (conversation-actions-sheet.tsx): a field with the current title, and save.
 * A screen rather than a field in the sheet, so the keyboard animation keeps it in view (as the project form).
 * `back` is the page the menu was opened on: saving or going back returns there.
 */
export default function RenameConversationScreen() {
  const { id, title, back, at } = useLocalSearchParams<{ id: string; title?: string; back?: string; at?: string }>();
  // Drawer screens stay mounted: each opening (`at`) starts a fresh form.
  return <RenameForm key={`${id}:${at}`} id={id} title={title ?? ""} back={back} />;
}

function RenameForm({ id, title, back }: { id: string; title: string; back?: string }) {
  const { colors } = usePreferences();
  const router = useRouter();
  const rename = useRenameConversation();
  const [name, setName] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const backTo = (back || "/new") as Href;

  const { height } = useReanimatedKeyboardAnimation();
  const keyboardPadding = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -height.value) }));

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !rename.isPending;

  function save() {
    if (!canSave) return;
    setError(null);
    rename.mutate(
      { id, title: trimmed },
      {
        onSuccess: () => router.navigate(backTo),
        onError: (cause) => setError(cause instanceof ApiError ? cause.message : "Try again later."),
      },
    );
  }

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background }, keyboardPadding]}>
      <Stack.Screen options={{ title: "Rename", headerLeft: () => <BackButton to={backTo} /> }} />
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={TITLE_MAX}
        placeholder="Name"
        placeholderTextColor={colors.muted}
        editable={!rename.isPending}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={save}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.4 }]}
      >
        {rename.isPending ? (
          <ActivityIndicator color={colors.accentText} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.accentText }]}>Save</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// The project form's field and button (app/(drawer)/projects/form.tsx).
const styles = StyleSheet.create({
  root: { flex: 1, gap: 10, padding: 16 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 14, marginTop: 4 },
  button: { marginTop: 16, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
