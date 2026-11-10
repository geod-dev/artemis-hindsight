"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

/** The header button that reopens a collapsed sidebar. Hidden while the sidebar is open, which has its own close button. */
export function SidebarOpenTrigger({ className }: { className?: string }) {
  const { isMobile, state } = useSidebar();
  if (!isMobile && state === "expanded") return null;
  return <SidebarTrigger className={className} />;
}
