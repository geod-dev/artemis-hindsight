import type { ReactNode } from "react";
import { SidebarOpenTrigger } from "@/components/sidebar-open-trigger";

/** Full-height frame for a chat page: a slim header with the button that reopens a collapsed sidebar, then the chat fills the rest. */
export function ChatPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 px-3">
        <SidebarOpenTrigger className="-ml-1 cursor-pointer text-muted-foreground hover:text-foreground" />
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
