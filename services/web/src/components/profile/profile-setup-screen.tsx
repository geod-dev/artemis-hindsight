"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAvatarColorId, type AvatarColorId } from "@/lib/avatar-colors";
import { ColorSwatches } from "./color-swatches";
import { ProfileAvatar } from "./profile-avatar";
import { saveProfile } from "./save-profile";

/**
 * Shown in place of the app while the display name or the color is missing. Prefilled with whatever is already set.
 */
export function ProfileSetupScreen({
  username,
  initialDisplayName,
  initialColor,
}: {
  username: string;
  initialDisplayName: string | null;
  initialColor: string | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [color, setColor] = useState<AvatarColorId | null>(isAvatarColorId(initialColor) ? initialColor : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = displayName.trim();
  const canSave = trimmed.length > 0 && color !== null && !saving;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || color === null) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ displayName: trimmed, avatarColor: color });
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "could not save the profile");
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ProfileAvatar name={trimmed} username={username} color={color} size={44} />
            <div className="min-w-0">
              <CardTitle>Set up your profile</CardTitle>
              <CardDescription>Your name and color are shown in the app and given to the assistant.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form id="profile-setup" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-display-name">Display name</Label>
              <Input
                id="setup-display-name"
                autoFocus
                maxLength={40}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How should we call you?"
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Color</Label>
              <ColorSwatches value={color} onChange={setColor} disabled={saving} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" form="profile-setup" disabled={!canSave}>
            {saving ? "Saving…" : "Continue"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
