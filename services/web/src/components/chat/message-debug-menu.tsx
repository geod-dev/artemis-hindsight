"use client";

import { BugIcon, EllipsisIcon } from "lucide-react";
import { useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConversationIdContext } from "./conversation-context";
import { MessageDebugDialog } from "./message-debug-dialog";

export interface MessageDebugMenuProps {
  messageId: string;
  /** Called when the menu opens or closes, so the action row can stay visible while the menu is open. */
  onMenuOpenChange?: (open: boolean) => void;
}

/**
 * The "..." menu of a message's action row, with "Debug". The dialog is rendered beside the menu, not inside it,
 * so it stays open after the menu closes.
 */
export function MessageDebugMenu({ messageId, onMenuOpenChange }: MessageDebugMenuProps) {
  const conversationId = useContext(ConversationIdContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  if (!conversationId) return null;

  const changeMenuOpen = (open: boolean) => {
    setMenuOpen(open);
    onMenuOpenChange?.(open);
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={changeMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More message actions">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setDebugOpen(true)}>
            <BugIcon />
            Debug
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MessageDebugDialog
        open={debugOpen}
        onOpenChange={setDebugOpen}
        conversationId={conversationId}
        messageId={messageId}
      />
    </>
  );
}
