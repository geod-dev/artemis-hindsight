import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api";
import { AVATAR_COLOR_IDS, AVATAR_COLORS, isAvatarColorId, type AvatarColorId } from "@/lib/avatar";
import { useAuth } from "@/auth";
import { usePreferences } from "@/preferences";

interface ProfileFormProps {
  initialDisplayName: string | null;
  initialColor: string | null;
  submitLabel: string;
  onSaved: () => void;
}

/** Display name and avatar color. Used on first sign-in (setup) and in the profile settings. */
export function ProfileForm({ initialDisplayName, initialColor, submitLabel, onSaved }: ProfileFormProps) {
  const { colors } = usePreferences();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [color, setColor] = useState<AvatarColorId | null>(isAvatarColorId(initialColor) ? initialColor : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = displayName.trim().length > 0 && color !== null && !saving;

  async function save() {
    if (!color || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/me/profile", { method: "PATCH", json: { displayName: displayName.trim(), avatarColor: color } });
      await refreshUser();
      await queryClient.invalidateQueries();
      onSaved();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not save the profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.label, { color: colors.muted }]}>Display name</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your first name"
        placeholderTextColor={colors.muted}
        autoCapitalize="words"
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <Text style={[styles.label, { color: colors.muted }]}>Color</Text>
      <View style={styles.swatches}>
        {AVATAR_COLOR_IDS.map((id) => {
          const selected = color === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={id}
              accessibilityState={{ selected }}
              onPress={() => setColor(id)}
              style={[
                styles.swatch,
                { backgroundColor: AVATAR_COLORS[id] },
                selected && { borderWidth: 3, borderColor: colors.text },
              ]}
            />
          );
        })}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <Pressable
        onPress={() => void save()}
        disabled={!canSave}
        style={[styles.button, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.4 }]}
      >
        {saving ? (
          <ActivityIndicator color={colors.accentText} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.accentText }]}>{submitLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10, padding: 16 },
  label: { fontSize: 13, fontWeight: "500", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  error: { fontSize: 14, marginTop: 4 },
  button: { marginTop: 16, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
