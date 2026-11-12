import type { ReactNode } from "react";
import { SidebarOpenTrigger } from "@/components/sidebar-open-trigger";

/** Full-height chat frame: the button that reopens a collapsed sidebar, the conversation's name, then the chat. */
export function ChatPageFrame({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 px-3">
        <SidebarOpenTrigger className="-ml-1 cursor-pointer text-muted-foreground hover:text-foreground" />
        <div className="min-w-0 flex-1 text-sm font-medium">{title}</div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
