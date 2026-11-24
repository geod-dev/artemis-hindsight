import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ColorSwatches } from "@/components/color-swatches";
import { apiFetch, ApiError } from "@/lib/api";
import { isAvatarColorId, type AvatarColorId } from "@/lib/avatar";
import { useAuth } from "@/auth";
import { usePreferences } from "@/preferences";

/** How long the name waits after the last keystroke before it is saved (same delay as the web's profile page). */
const NAME_SAVE_DELAY_MS = 600;

type ProfileFormProps = {
  initialDisplayName: string | null;
  initialColor: string | null;
} & (
  | {
      /** First sign-in: a button saves the profile, then `onSaved` moves on. */
      mode: "submit";
      submitLabel: string;
      onSaved: () => void;
    }
  | {
      /**
       * Profile settings: saved as it changes, like the appearance settings and the web's profile page. A colour on tap,
       * the name once typing stops or the field is left. An empty name is not saved.
       */
      mode: "auto";
    }
);

/** Display name and avatar color. Used on first sign-in (setup) and in the profile settings. */
export function ProfileForm(props: ProfileFormProps) {
  const { initialDisplayName, initialColor } = props;
  const { colors } = usePreferences();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [color, setColor] = useState<AvatarColorId | null>(isAvatarColorId(initialColor) ? initialColor : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = displayName.trim().length > 0 && color !== null && !saving;

  const send = useCallback(
    async (values: { displayName: string; avatarColor: AvatarColorId }) => {
      await apiFetch("/api/me/profile", { method: "PATCH", json: values });
      await refreshUser();
      await queryClient.invalidateQueries();
    },
    [queryClient, refreshUser],
  );

  async function submit() {
    if (props.mode !== "submit" || !color || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await send({ displayName: displayName.trim(), avatarColor: color });
      props.onSaved();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not save the profile");
    } finally {
      setSaving(false);
    }
  }

  // Auto mode: saves run one after another, so an older name never lands after a newer one.
  const saved = useRef({ displayName: (initialDisplayName ?? "").trim(), color });
  const queue = useRef(Promise.resolve());
  const persist = useCallback(
    (name: string, nextColor: AvatarColorId | null) => {
      const displayName = name.trim();
      if (!displayName || !nextColor) return;
      const previous = saved.current;
      if (displayName === previous.displayName && nextColor === previous.color) return;
      saved.current = { displayName, color: nextColor };
      queue.current = queue.current.then(async () => {
        try {
          await send({ displayName, avatarColor: nextColor });
          setError(null);
        } catch (cause) {
          // The next change sends everything again.
          saved.current = previous;
          setError(cause instanceof ApiError ? cause.message : "Could not save the profile");
        }
      });
    },
    [send],
  );

  const auto = props.mode === "auto";
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => persist(displayName, color), NAME_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // Only typing waits: `color` is left out, a colour is saved on tap with the name as it is.
  }, [auto, displayName, persist]);

  function pickColor(next: AvatarColorId) {
    setColor(next);
    if (auto) persist(displayName, next);
  }

  /** Leaving the field saves the name now; an empty name is not saved and the last saved one comes back. */
  function leaveName() {
    if (!auto) return;
    const trimmed = displayName.trim();
    if (!trimmed) {
      setDisplayName(saved.current.displayName);
      return;
    }
    setDisplayName(trimmed);
    persist(trimmed, color);
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.label, { color: colors.muted }]}>Display name</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        onBlur={leaveName}
        placeholder="Your first name"
        placeholderTextColor={colors.muted}
        autoCapitalize="words"
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <Text style={[styles.label, { color: colors.muted }]}>Color</Text>
      <ColorSwatches value={color} onChange={pickColor} />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {props.mode === "submit" ? (
        <Pressable
          onPress={() => void submit()}
          disabled={!canSave}
          style={[styles.button, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.4 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.accentText }]}>{props.submitLabel}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10, padding: 16 },
  label: { fontSize: 13, fontWeight: "500", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 14, marginTop: 4 },
  button: { marginTop: 16, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
