"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { selectNewChatProject } from "@/lib/new-chat-project";
import { newChatInProjectHref, type ProjectSummary } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { ProjectIcon } from "./project-icon";

/** A project in the sidebar's Projects list. It can be dragged to another place; its link and menu work as before. */
export function SortableProjectRow({
  project,
  active,
  unread,
  onEdit,
  onDelete,
}: {
  project: ProjectSummary;
  active: boolean;
  unread: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  return (
    <SidebarMenuItem
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "z-10 opacity-60")}
      // A browser drag of the link or the icon would navigate when dropped: dnd-kit alone handles the drag.
      onDragStart={(event) => event.preventDefault()}
      {...attributes}
      {...listeners}
    >
      <SidebarMenuButton asChild isActive={active} tooltip={project.name}>
        <Link href={newChatInProjectHref(project.id)} onClick={() => selectNewChatProject(project.id)}>
          <ProjectIcon project={project} size={16} />
          <span className="truncate">{project.name}</span>
          {unread && (
            <span
              role="status"
              aria-label="Unread reply in this project"
              className="ml-auto size-2 shrink-0 rounded-full bg-primary"
            />
          )}
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label={`Actions for ${project.name}`}>
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
