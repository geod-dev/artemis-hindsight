export const AVATAR_COLORS = [
  "rose",
  "pink",
  "fuchsia",
  "purple",
  "violet",
  "indigo",
  "blue",
  "sky",
  "cyan",
  "teal",
  "emerald",
  "green",
  "lime",
  "yellow",
  "orange",
  "red",
] as const;

export type AvatarColorId = (typeof AVATAR_COLORS)[number];

export function isAvatarColorId(value: unknown): value is AvatarColorId {
  return AVATAR_COLORS.some((color) => color === value);
}

/** The color a user gets until they choose one: stable for a username, so it does not change between visits. */
export function fallbackAvatarColor(username: string): AvatarColorId {
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? "blue";
}

/** The CSS color of an avatar, from the --avatar-* tokens in globals.css. */
export function avatarColorCss(id: string | null | undefined, username: string): string {
  const chosen = isAvatarColorId(id) ? id : fallbackAvatarColor(username);
  return `var(--avatar-${chosen})`;
}
