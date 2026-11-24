"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ColorSwatches } from "@/components/profile/color-swatches";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { saveProfile } from "@/components/profile/save-profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAvatarColorId, type AvatarColorId } from "@/lib/avatar-colors";
import { SettingsPage } from "./settings-page";

const MAX_NAME = 40;
/** How long the name waits after the last keystroke before it is saved. */
const NAME_SAVE_DELAY_MS = 600;

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

  const [displayName, setDisplayName] = useState(savedDisplayName);
  const [color, setColor] = useState<AvatarColorId | null>(initialColor);
  const [error, setError] = useState<string | null>(null);
  const trimmed = displayName.trim();

  // Saved as it changes, like the appearance page: a colour on click, the name once typing stops or the field is left.
  // Saves run one after another, so an older name never lands after a newer one. The phone's profile does the same.
  const saved = useRef({ displayName: savedDisplayName, color: initialColor });
  const queue = useRef(Promise.resolve());

  const persist = useCallback(
    (name: string, nextColor: AvatarColorId | null) => {
      const values = { displayName: name.trim(), avatarColor: nextColor };
      if (!values.displayName || !values.avatarColor) return;
      const previous = saved.current;
      if (values.displayName === previous.displayName && values.avatarColor === previous.color) return;
      saved.current = { displayName: values.displayName, color: values.avatarColor };
      const avatarColor = values.avatarColor;
      queue.current = queue.current.then(async () => {
        try {
          await saveProfile({ displayName: values.displayName, avatarColor });
          setError(null);
          router.refresh();
        } catch (saveError) {
          // The next change sends everything again.
          saved.current = previous;
          setError(saveError instanceof Error ? saveError.message : "could not save the profile");
        }
      });
    },
    [router],
  );

  useEffect(() => {
    const timer = setTimeout(() => persist(displayName, color), NAME_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // Only typing waits: `color` is left out, a colour is saved on click with the name as it is.
  }, [displayName, persist]);

  function pickColor(next: AvatarColorId) {
    setColor(next);
    persist(displayName, next);
  }

  /** Leaving the field saves the name now; an empty name is not saved and the last saved one comes back. */
  function leaveName() {
    if (!trimmed) {
      setDisplayName(saved.current.displayName);
      return;
    }
    setDisplayName(trimmed);
    persist(trimmed, color);
  }

  return (
    <SettingsPage title="Profile" description="How you appear in the app and to the assistant.">
      <section className="flex items-center gap-5">
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
            onBlur={leaveName}
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground">Up to {MAX_NAME} characters.</p>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Avatar color</Label>
          <ColorSwatches value={color} onChange={pickColor} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    </SettingsPage>
  );
}
