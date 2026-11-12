import { isAvatarColorId } from "./avatar-colors";

/** The name and the color are both needed before the app can be used. */
export function isProfileComplete(user: { displayName: string | null; avatarColor: string | null }): boolean {
  return Boolean(user.displayName?.trim()) && isAvatarColorId(user.avatarColor);
}

/** Up to two letters for the avatar: the first letter of the first two words. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}
