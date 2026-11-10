import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { listConversations } from "@/server/repositories/conversation-repository";
import "./globals.css";

// Reads the database on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Artemis",
  description: "Chat with an AI agent that has a sandboxed computer and long-term memory.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const conversations = await listConversations();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar
                conversations={conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }))}
              />
              <SidebarInset className="h-svh min-h-0 overflow-hidden">{children}</SidebarInset>
              <ThemeToggle className="fixed right-4 bottom-4 z-50" />
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
