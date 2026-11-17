"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { paletteColorCss } from "@/lib/avatar-colors";
import { newChatInProjectHref, type ProjectRef } from "@/lib/projects";

/**
 * A conversation's project, after its title in the top bar. It links to the new chat with that project selected. The
 * tint is the project's color, as the new chat's badge is.
 */
export function ProjectBadge({ project }: { project: ProjectRef }) {
  const color = paletteColorCss(project.color);
  return (
    <Badge
      asChild
      variant="outline"
      className="max-w-40 cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-[filter] hover:brightness-95 dark:hover:brightness-110"
      style={{
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
      }}
    >
      <Link href={newChatInProjectHref(project.id)} aria-label={`New chat in project ${project.name}`} title={`New chat in ${project.name}`}>
        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{project.name}</span>
      </Link>
    </Badge>
  );
}
