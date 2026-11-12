"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ColorSwatches } from "@/components/profile/color-swatches";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { saveProfile } from "@/components/profile/save-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAvatarColorId, type AvatarColorId } from "@/lib/avatar-colors";

const MAX_NAME = 40;

export function ProfileSettings({
  username,
  savedDisplayName,
  savedColor,
}: {
  username: string;
  savedDisplayName: string;
  savedColor: string | null;
}) {
  const router = useRouter();
  const initialColor = isAvatarColorId(savedColor) ? savedColor : null;

  const [saved, setSaved] = useState({ displayName: savedDisplayName, color: initialColor });
  const [displayName, setDisplayName] = useState(savedDisplayName);
  const [color, setColor] = useState<AvatarColorId | null>(initialColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = displayName.trim();
  const dirty = displayName !== saved.displayName || color !== saved.color;
  const canSave = dirty && trimmed.length > 0 && color !== null && !saving;

  function revert() {
    setDisplayName(saved.displayName);
    setColor(saved.color);
    setError(null);
  }

  async function save() {
    if (!canSave || color === null) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ displayName: trimmed, avatarColor: color });
      setSaved({ displayName: trimmed, color });
      setDisplayName(trimmed);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "could not save the profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">How you appear in the app and to the assistant.</p>
      </header>

      <section className="flex items-center gap-5 rounded-xl border bg-card p-5">
        <ProfileAvatar name={trimmed} username={username} color={color} size={64} />
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">{trimmed || username}</p>
          <p className="text-sm text-muted-foreground">@{username}</p>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-display-name">Display name</Label>
          <Input
            id="profile-display-name"
            maxLength={MAX_NAME}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={saving}
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground">Up to {MAX_NAME} characters.</p>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Avatar color</Label>
          <ColorSwatches value={color} onChange={setColor} disabled={saving} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {dirty && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex w-[min(calc(100%-2rem),36rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-xl border bg-popover px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <p className="text-sm">You have unsaved changes.</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={revert} disabled={saving} className="gap-1.5">
              <RotateCcw className="size-3.5" />
              Revert
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={!canSave}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
