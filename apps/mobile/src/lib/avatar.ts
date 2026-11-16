/** Same palette and fallback rule as the web app (services/web/src/lib/avatar-colors.ts, globals.css). */
export const AVATAR_COLORS = {
  rose: "#f43f5e",
  pink: "#ec4899",
  fuchsia: "#d946ef",
  purple: "#a855f7",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  blue: "#3b82f6",
  sky: "#0ea5e9",
  cyan: "#06b6d4",
  teal: "#14b8a6",
  emerald: "#10b981",
  green: "#22c55e",
  lime: "#84cc16",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
} as const;

export type AvatarColorId = keyof typeof AVATAR_COLORS;

export const AVATAR_COLOR_IDS = Object.keys(AVATAR_COLORS) as AvatarColorId[];

export function isAvatarColorId(value: unknown): value is AvatarColorId {
  return typeof value === "string" && value in AVATAR_COLORS;
}

/** The color a user gets until they choose one: stable for a username. */
export function fallbackAvatarColor(username: string): AvatarColorId {
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLOR_IDS[hash % AVATAR_COLOR_IDS.length] ?? "blue";
}

export function avatarHex(id: string | null | undefined, username: string): string {
  return AVATAR_COLORS[isAvatarColorId(id) ? id : fallbackAvatarColor(username)];
}

/** Initials for the avatar bubble, as the web app shows them. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase() || "?";
}
