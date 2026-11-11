"use client";

import { LogOut, MessageSquarePlus, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useConversationTitles } from "@/components/conversation-titles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export interface SidebarConversation {
  id: string;
  title: string;
  updatedAt: string;
}

export function AppSidebar({ username, conversations }: { username: string; conversations: SidebarConversation[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { renamed } = useConversationTitles();
  const [pendingDelete, setPendingDelete] = useState<SidebarConversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  // A name received in this session wins over the title the server rendered.
  const titleOf = (conversation: SidebarConversation) => renamed[conversation.id] ?? conversation.title;

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/conversations/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`delete failed with HTTP ${res.status}`);
      if (pathname === `/c/${pendingDelete.id}`) router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
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
          <Link href="/">
            <MessageSquarePlus className="size-4" />
            New chat
          </Link>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No conversations yet.</p>
              )}
              {conversations.map((conversation) => {
                const href = `/c/${conversation.id}`;
                const title = titleOf(conversation);
                return (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton asChild isActive={pathname === href} tooltip={title}>
                      <Link href={href}>
                        <span className="truncate">{title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover aria-label={`Actions for ${title}`}>
                          <MoreHorizontal />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem onSelect={() => setPendingDelete(conversation)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="truncate text-sm text-muted-foreground" title="Signed in as">
            {username}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void signOut()} className="gap-2">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete ? titleOf(pendingDelete) : ""}” and all of its messages will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
