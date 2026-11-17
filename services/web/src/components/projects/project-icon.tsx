import { Folder } from "lucide-react";
import { paletteColorCss } from "@/lib/avatar-colors";
import { projectIconUrl, type ProjectSummary } from "@/lib/projects";
import { cn } from "@/lib/utils";

/** A project's icon: its uploaded image, or a folder in the project's color when it has none. */
export function ProjectIcon({
  project,
  size = 16,
  className,
}: {
  project: Pick<ProjectSummary, "id" | "color" | "hasIcon" | "updatedAt">;
  size?: number;
  className?: string;
}) {
  // Both kinds of icon fill the same fixed, centered box, so the icon sits on the same line as the label whatever the
  // parent's own icon sizing is.
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {project.hasIcon ? (
        // A private, per-user icon served by the API: a plain img, as next/image cannot optimize it anyway.
        <img
          src={projectIconUrl(project)}
          alt=""
          draggable={false}
          className="size-full rounded-[4px] object-cover"
        />
      ) : (
        <Folder aria-hidden className="size-full" fill="currentColor" style={{ color: paletteColorCss(project.color) }} />
      )}
    </span>
  );
}

/** A thin vertical bar in the project's color, shown before a conversation's name. */
export function ProjectBar({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("h-4 w-[3px] shrink-0 rounded-full", className)}
      style={{ backgroundColor: paletteColorCss(color) }}
    />
  );
}
