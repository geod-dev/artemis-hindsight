import { Button, Column, RNHostView, Text, TextInput } from "@expo/ui";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ColorSwatches } from "@/components/color-swatches";
import { M3Host } from "@/components/m3";
import { apiFetch, ApiError } from "@/lib/api";
import { isAvatarColorId, type AvatarColorId } from "@/lib/avatar";
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
  const { refreshUser } = useAuth();
  const { colors } = usePreferences();
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
    <M3Host matchContents={{ vertical: true }}>
      <Column>
        <Text>Display name</Text>
        <TextInput onChangeText={setDisplayName} placeholder="Your first name" autoCapitalize="words" />
        <Text>Color</Text>
        <RNHostView matchContents>
          <ColorSwatches value={color} onChange={setColor} />
        </RNHostView>
        {error ? <Text textStyle={{ color: colors.danger }}>{error}</Text> : null}
        <Button onPress={() => void save()} disabled={!canSave}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </Column>
    </M3Host>
  );
}
