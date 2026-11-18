"use client";

import { Archive, ChevronDown, FolderInput, FolderMinus, ListFilter, MessageSquarePlus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useConversationTitles } from "@/components/conversation-titles";
import { deleteProject } from "@/components/projects/project-api";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ProjectIcon } from "@/components/projects/project-icon";
import { SortableProjectRow } from "@/components/projects/sortable-project-row";
import { useProjectOrder } from "@/components/projects/use-project-order";
import {
  conversationIdFromDragId,
  DraggableConversationRow,
} from "@/components/conversations/draggable-conversation-row";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { selectNewChatProject, useNewChatProjectSelection } from "@/lib/new-chat-project";
import {
  readShowProjectConversations,
  readSidebarGroupCollapsed,
  writeShowProjectConversations,
  writeSidebarGroupCollapsed,
  type SidebarGroupName,
} from "@/lib/sidebar-prefs";
import { newChatInProjectHref, type ConversationSummary, type ProjectSummary } from "@/lib/projects";
import { cn } from "@/lib/utils";

/**
 * A group label that folds its group when clicked. A small chevron shows when the sidebar is hovered.
 */
function CollapsibleGroupLabel({
  label,
  collapsed,
  controls,
  onToggle,
}: {
  label: string;
  collapsed: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <SidebarGroupLabel asChild>
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={controls}
        onClick={onToggle}
        className="group/label w-full cursor-pointer gap-1 text-left hover:text-sidebar-foreground"
      >
        {label}
        {/* Shown when the sidebar is hovered, or when the label has keyboard focus. A span, not a direct svg child:
            the label's own [&>svg] sizing would otherwise apply to the chevron. */}
        <span
          aria-hidden
          className="flex size-3 items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible/label:opacity-100"
        >
          <ChevronDown className={cn("size-3 transition-transform duration-200", collapsed && "-rotate-90")} />
        </span>
      </button>
    </SidebarGroupLabel>
  );
}

/**
 * The app's sidebar: the new chat button, the projects (drag them to reorder; each opens the new chat with it selected),
 * then the recent conversations. Each group folds when its label is clicked.
 */
export function AppSidebar({
  username,
  displayName,
  avatarColor,
  projects,
  conversations,
}: {
  username: string;
  displayName: string | null;
  avatarColor: string | null;
  projects: ProjectSummary[];
  conversations: ConversationSummary[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { renamed } = useConversationTitles();

  // A reply can finish while the user is in another conversation: the list (and its unread dots) is refreshed.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(timer);
  }, [router]);

  // The sort menu of Recents, and which groups are folded. Read from the browser after mount, so the server render and
  // the first paint agree.
  const [showProjectConversations, setShowProjectConversations] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<SidebarGroupName, boolean>>({
    projects: false,
    recents: false,
  });
  useEffect(() => {
    setShowProjectConversations(readShowProjectConversations());
    setCollapsedGroups({
      projects: readSidebarGroupCollapsed("projects"),
      recents: readSidebarGroupCollapsed("recents"),
    });
  }, []);
  const toggleGroup = (group: SidebarGroupName) => {
    const next = !collapsedGroups[group];
    setCollapsedGroups({ ...collapsedGroups, [group]: next });
    writeSidebarGroupCollapsed(group, next);
  };
  const toggleProjectConversations = (show: boolean) => {
    setShowProjectConversations(show);
    writeShowProjectConversations(show);
  };
  const recentConversations = showProjectConversations
    ? conversations
    : conversations.filter((conversation) => !conversation.project);

  // The project the new chat page has selected, whether the picker or the sidebar chose it.
  const pickedProjectId = useNewChatProjectSelection();
  const activeProjectId = pathname === "/" ? pickedProjectId : null;
  // A project shows an unread dot while one of its conversations has an unread reply that is not open now.
  const unreadProjectIds = new Set(
    conversations.flatMap((conversation) =>
      conversation.unread && conversation.project && pathname !== `/c/${conversation.id}` ? [conversation.project.id] : [],
    ),
  );

  const [pendingConversationDelete, setPendingConversationDelete] = useState<ConversationSummary | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  // Set while the project dialog creates a project for a conversation: the new project then takes the conversation.
  const [conversationToMove, setConversationToMove] = useState<ConversationSummary | null>(null);
  const [pendingProjectDelete, setPendingProjectDelete] = useState<ProjectSummary | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);

  // A name received in this session wins over the title the server rendered.
  const titleOf = (conversation: ConversationSummary) => renamed[conversation.id] ?? conversation.title;

  /** Moves the conversation to the archived list. It stays on screen if it is open; the list is refreshed. */
  async function archive(conversation: ConversationSummary) {
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok && res.status !== 404) throw new Error(`archive failed with HTTP ${res.status}`);
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  }

  /** Puts the conversation in a project, or takes it out of its project (null). The lists are refreshed. */
  async function moveConversation(conversation: ConversationSummary, projectId: string | null) {
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok && res.status !== 404) throw new Error(`move failed with HTTP ${res.status}`);
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  }

  async function confirmDeleteConversation() {
    if (!pendingConversationDelete) return;
    setDeletingConversation(true);
    try {
      const res = await fetch(`/api/conversations/${pendingConversationDelete.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`delete failed with HTTP ${res.status}`);
      if (pathname === `/c/${pendingConversationDelete.id}`) router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingConversation(false);
      setPendingConversationDelete(null);
    }
  }

  async function confirmDeleteProject() {
    if (!pendingProjectDelete) return;
    setDeletingProject(true);
    setProjectDeleteError(null);
    try {
      await deleteProject(pendingProjectDelete.id);
      // The new chat must not keep sending a project that no longer exists.
      selectNewChatProject(null);
      if (activeProjectId === pendingProjectDelete.id) router.push("/");
      router.refresh();
      setPendingProjectDelete(null);
    } catch (error) {
      setProjectDeleteError(error instanceof Error ? error.message : "the project could not be deleted");
    } finally {
      setDeletingProject(false);
    }
  }

  const {
    ordered: orderedProjects,
    sensors: dragSensors,
    collisionDetection,
    onDragEnd: onProjectDragEnd,
    markDragEnded,
  } = useProjectOrder(projects);

  /** One drag context for the whole sidebar: a project dropped on another place is reordered, a conversation dropped on a project moves into it. */
  function onSidebarDragEnd(event: DragEndEvent) {
    const conversationId = conversationIdFromDragId(String(event.active.id));
    if (conversationId === null) {
      onProjectDragEnd(event);
      return;
    }
    markDragEnded();
    const { over } = event;
    const conversation = conversations.find((candidate) => candidate.id === conversationId);
    if (!over || !conversation) return;
    const projectId = String(over.id);
    if (projectId === conversation.project?.id || !projects.some((project) => project.id === projectId)) return;
    void moveConversation(conversation, projectId);
  }

  function openNewProject() {
    setEditingProject(null);
    setProjectDialogOpen(true);
  }

  function openEditProject(project: ProjectSummary) {
    setEditingProject(project);
    setProjectDialogOpen(true);
  }

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold tracking-tight">Artemis</span>
          <SidebarTrigger
            aria-label="Close sidebar"
            className="cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
          />
        </div>
        <Button asChild variant="outline" className="w-full justify-start gap-2">
          <Link href="/" onClick={() => selectNewChatProject(null)}>
            <MessageSquarePlus className="size-4" />
            New chat
          </Link>
        </Button>
      </SidebarHeader>

      {/* A fixed id: dnd-kit otherwise numbers its accessibility ids per render, which differs between server and client. */}
      <DndContext id="sidebar-dnd" sensors={dragSensors} collisionDetection={collisionDetection} onDragEnd={onSidebarDragEnd}>
        <SidebarContent>
          <SidebarGroup>
            <CollapsibleGroupLabel
              label="Projects"
              collapsed={collapsedGroups.projects}
              controls="sidebar-projects-list"
              onToggle={() => toggleGroup("projects")}
            />
            {/* Hidden until the sidebar is hovered, like its close button. */}
            <SidebarGroupAction
              aria-label="New project"
              title="New project"
              onClick={openNewProject}
              className="text-sidebar-foreground/70 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [&>svg]:size-3"
            >
              <Plus />
            </SidebarGroupAction>
            <SidebarGroupContent id="sidebar-projects-list" hidden={collapsedGroups.projects}>
              <SidebarMenu>
                {projects.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects yet.</p>
                )}
                {/* Projects are dragged into another place: the new order is saved as soon as it is dropped. */}
                <SortableContext items={orderedProjects.map((project) => project.id)} strategy={verticalListSortingStrategy}>
                  {orderedProjects.map((project) => (
                    <SortableProjectRow
                      key={project.id}
                      project={project}
                      active={activeProjectId === project.id}
                      unread={unreadProjectIds.has(project.id)}
                      onEdit={() => openEditProject(project)}
                      onDelete={() => {
                        setProjectDeleteError(null);
                        setPendingProjectDelete(project);
                      }}
                    />
                  ))}
                </SortableContext>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <CollapsibleGroupLabel
              label="Recents"
              collapsed={collapsedGroups.recents}
              controls="sidebar-recents-list"
              onToggle={() => toggleGroup("recents")}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarGroupAction
                  aria-label="Sort and filter recents"
                  title="Sort and filter recents"
                  className="text-sidebar-foreground/70 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [&>svg]:size-3"
                >
                  <ListFilter />
                  {/* A tiny dot while project conversations are left out of Recents. */}
                  {!showProjectConversations && (
                    <span aria-hidden className="absolute top-0 right-0 size-1 rounded-full bg-primary" />
                  )}
                </SidebarGroupAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="rounded-xl bg-popover/95 backdrop-blur">
                <DropdownMenuCheckboxItem
                  checked={showProjectConversations}
                  onCheckedChange={toggleProjectConversations}
                  onSelect={(event) => event.preventDefault()}
                >
                  Show project conversations
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <SidebarGroupContent id="sidebar-recents-list" hidden={collapsedGroups.recents}>
              <SidebarMenu>
                {recentConversations.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    {conversations.length === 0 ? "No conversations yet." : "No conversations outside projects."}
                  </p>
                )}
                {recentConversations.map((conversation) => {
                  const href = `/c/${conversation.id}`;
                  const title = titleOf(conversation);
                  const showUnread = conversation.unread && pathname !== href;
                  return (
                    <DraggableConversationRow
                      key={conversation.id}
                      conversationId={conversation.id}
                      title={title}
                      href={href}
                      project={conversation.project}
                      unread={showUnread}
                      active={pathname === href}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction showOnHover aria-label={`Actions for ${title}`}>
                            <MoreHorizontal />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="right"
                          align="start"
                          // The project dialog opens from this menu: it takes the focus, the menu must not hand it back.
                          onCloseAutoFocus={(event) => event.preventDefault()}
                        >
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <FolderInput />
                              Move to project
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {projects.length === 0 && <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>}
                              {orderedProjects.map((project) => (
                                <DropdownMenuItem
                                  key={project.id}
                                  disabled={conversation.project?.id === project.id}
                                  onSelect={() => void moveConversation(conversation, project.id)}
                                >
                                  <ProjectIcon project={project} size={14} />
                                  <span className="truncate">{project.name}</span>
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => {
                                  // The dialog opens over the menu; once a project is created, it takes this conversation.
                                  setConversationToMove(conversation);
                                  setEditingProject(null);
                                  setProjectDialogOpen(true);
                                }}
                              >
                                <Plus />
                                New project
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          {conversation.project && (
                            <DropdownMenuItem onSelect={() => void moveConversation(conversation, null)}>
                              <FolderMinus />
                              Remove from project
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => void archive(conversation)}>
                            <Archive />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setPendingConversationDelete(conversation)}>
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </DraggableConversationRow>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </DndContext>

      <SidebarFooter className="p-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ProfileAvatar name={displayName} username={username} color={avatarColor} size={32} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName || username}</span>
        </Link>
      </SidebarFooter>

      <SidebarRail />

      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={(open) => {
          setProjectDialogOpen(open);
          if (!open) setConversationToMove(null);
        }}
        project={editingProject}
        usedColors={projects.map((project) => project.color)}
        onSaved={(saved) => {
          if (conversationToMove) {
            // Created from "Move to project": the conversation goes into it.
            void moveConversation(conversationToMove, saved.id);
            setConversationToMove(null);
          } else if (editingProject) {
            router.refresh();
          } else {
            // A new project opens the new chat with it selected.
            router.push(newChatInProjectHref(saved.id));
          }
        }}
      />

      <AlertDialog open={pendingProjectDelete !== null} onOpenChange={(open) => !open && setPendingProjectDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingProjectDelete?.name}” and its folder, files and icon will be removed. Its conversations stay in
              Recents, outside any project. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {projectDeleteError && <p className="text-sm text-destructive">{projectDeleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProject}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteProject();
              }}
              disabled={deletingProject}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingConversationDelete !== null}
        onOpenChange={(open) => !open && setPendingConversationDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingConversationDelete ? titleOf(pendingConversationDelete) : ""}” and all of its messages will be
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingConversation}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteConversation();
              }}
              disabled={deletingConversation}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
