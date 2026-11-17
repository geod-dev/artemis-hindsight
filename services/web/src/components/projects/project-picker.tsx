"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { paletteColorCss } from "@/lib/avatar-colors";
import type { ProjectSummary } from "@/lib/projects";
import { ProjectIcon } from "./project-icon";

/**
 * The project of a new chat, shown centered under the mascot.
 *  - No project selected: a plain "Select project" button. Its list starts with "No project" (closes the list), then the
 *    projects, then "+ New project", which opens the project dialog; a project created there is selected.
 *  - A project selected: a badge in the project's color. The whole badge removes the project. There is no reselector
 *    meanwhile: to change, remove the project, then pick another.
 */
export function ProjectPicker({
  projects,
  value,
  onChange,
}: {
  projects: ProjectSummary[];
  value: string | null;
  onChange: (projectId: string | null) => void;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const selected = projects.find((project) => project.id === value) ?? null;

  if (selected) {
    const color = paletteColorCss(selected.color);
    return (
      <Badge
        asChild
        variant="outline"
        className="h-8 max-w-full cursor-pointer rounded-full pr-2 pl-3 text-sm font-medium transition-[filter] hover:brightness-95 dark:hover:brightness-110"
        style={{
          borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
          backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        }}
      >
        <button type="button" aria-label={`Remove project ${selected.name}`} onClick={() => onChange(null)}>
          <ProjectIcon project={selected} size={14} />
          <span className="truncate">{selected.name}</span>
          <X aria-hidden className="text-muted-foreground" />
        </button>
      </Badge>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="rounded-full font-normal text-muted-foreground">
            Select project
          </Button>
        </DropdownMenuTrigger>
        {/* The dialog takes the focus when it opens: the menu must not hand it back to the trigger. */}
        <DropdownMenuContent
          align="center"
          className="min-w-48 rounded-xl bg-popover/95 backdrop-blur"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuItem onSelect={() => undefined} className="text-muted-foreground">
            No project
          </DropdownMenuItem>
          {projects.map((project) => (
            <DropdownMenuItem key={project.id} onSelect={() => onChange(project.id)} className="gap-2">
              <ProjectIcon project={project} size={14} />
              <span className="truncate">{project.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-border/40" />
          <DropdownMenuItem onSelect={() => setCreating(true)} className="gap-2">
            <Plus className="size-3.5" />
            New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDialog
        open={creating}
        onOpenChange={setCreating}
        usedColors={projects.map((project) => project.color)}
        onSaved={(saved) => {
          onChange(saved.id);
          // The sidebar and this picker both list the projects: the server page is read again.
          router.refresh();
        }}
      />
    </>
  );
}
