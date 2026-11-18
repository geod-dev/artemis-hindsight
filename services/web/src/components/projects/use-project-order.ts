"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  restrictToFirstScrollableAncestor,
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { conversationIdFromDragId } from "@/components/conversations/draggable-conversation-row";
import { saveProjectOrder } from "@/components/projects/project-api";
import type { ProjectSummary } from "@/lib/projects";

/** How long after a drop the clicks are ignored: the browser may click whatever lies under the pointer. */
const GHOST_CLICK_WINDOW_MS = 500;

function isConversationDrag(activeId: string | number): boolean {
  return conversationIdFromDragId(String(activeId)) !== null;
}

/**
 * A project being reordered takes the nearest place. A conversation only lands on the project under the pointer (or,
 * dragged with the keyboard, the project it overlaps): dropped anywhere else, it stays where it was.
 */
const sidebarCollisionDetection: CollisionDetection = (args) => {
  if (!isConversationDrag(args.active.id)) return closestCenter(args);
  return args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);
};

/**
 * Keeps a dragged row inside the sidebar, so the drag never makes the sidebar scroll wider or taller. A project moves
 * only up and down its own list; a conversation moves within the sidebar's visible area, up to the projects.
 */
const restrictSidebarDrag: Modifier = (args) => {
  if (!args.active) return args.transform;
  if (isConversationDrag(args.active.id)) return restrictToFirstScrollableAncestor(args);
  return restrictToParentElement({ ...args, transform: restrictToVerticalAxis(args) });
};

const sidebarModifiers = [restrictSidebarDrag];

/**
 * The sidebar's project order. A drop shows the new order at once and saves it; the server's list replaces the shown
 * order when it arrives.
 */
export function useProjectOrder(projects: ProjectSummary[]) {
  const router = useRouter();
  const [order, setOrder] = useState<string[] | null>(null);
  const dragEndedAt = useRef(0);

  const ordered = useMemo(() => {
    if (!order) return projects;
    const byId = new Map(projects.map((project) => [project.id, project]));
    return order.flatMap((id) => byId.get(id) ?? []);
  }, [projects, order]);

  useEffect(() => {
    setOrder(null);
  }, [projects]);

  useEffect(() => {
    const ignoreGhostClick = (event: MouseEvent) => {
      if (Date.now() - dragEndedAt.current < GHOST_CLICK_WINDOW_MS) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("click", ignoreGhostClick, true);
    return () => window.removeEventListener("click", ignoreGhostClick, true);
  }, []);

  // A few pixels of movement start a drag, so a click still opens the project.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Call at the end of any sidebar drag: the click the pointer makes on release is ignored. */
  function markDragEnded() {
    dragEndedAt.current = Date.now();
  }

  function onDragEnd(event: DragEndEvent) {
    markDragEnded();
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = ordered.map((project) => project.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setOrder(next);
    saveProjectOrder(next)
      .then(() => router.refresh())
      .catch((error: unknown) => {
        console.error(error);
        setOrder(null);
        router.refresh();
      });
  }

  return {
    ordered,
    sensors,
    collisionDetection: sidebarCollisionDetection,
    modifiers: sidebarModifiers,
    onDragEnd,
    markDragEnded,
  };
}
