"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ConversationRowContent } from "@/components/conversations/conversation-row-content";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { ConversationSummary } from "@/lib/projects";
import { cn } from "@/lib/utils";

// Drag ids of conversations start with this, so a drop can tell them from the project ids it is dropped on.
const DRAG_PREFIX = "conversation:";

export function conversationDragId(conversationId: string): string {
  return `${DRAG_PREFIX}${conversationId}`;
}

/** The conversation id of a drag id, or null when the drag is not a conversation. */
export function conversationIdFromDragId(dragId: string): string | null {
  return dragId.startsWith(DRAG_PREFIX) ? dragId.slice(DRAG_PREFIX.length) : null;
}

/**
 * A conversation in the sidebar's Recents. It can be dragged onto a project to move into it; its link and menu work as
 * before. The menu is passed as children, so the row stays free of the sidebar's dialogs and state.
 */
export function DraggableConversationRow({
  conversationId,
  title,
  href,
  project,
  unread,
  running,
  active,
  children,
}: {
  conversationId: string;
  title: string;
  href: string;
  project: ConversationSummary["project"];
  unread: boolean;
  running: boolean;
  active: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: conversationDragId(conversationId),
  });
  return (
    <SidebarMenuItem
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "z-10 opacity-60")}
      // A browser drag of the link would navigate when dropped: dnd-kit alone handles the drag.
      onDragStart={(event) => event.preventDefault()}
      {...attributes}
      {...listeners}
    >
      <SidebarMenuButton asChild isActive={active} tooltip={title}>
        <Link href={href}>
          <ConversationRowContent title={title} project={project} unread={unread} running={running} />
        </Link>
      </SidebarMenuButton>
      {children}
    </SidebarMenuItem>
  );
}
