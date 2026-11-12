import { avatarColorCss } from "@/lib/avatar-colors";
import { initialsOf } from "@/lib/profile";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  name,
  username,
  color,
  size = 28,
  className,
}: {
  name: string | null;
  username: string;
  color: string | null;
  size?: number;
  className?: string;
}) {
  const label = name?.trim() || username;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: avatarColorCss(color, username), fontSize: size * 0.4 }}
    >
      {initialsOf(label)}
    </span>
  );
}
