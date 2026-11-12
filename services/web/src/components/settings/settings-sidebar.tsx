"use client";

import { ArrowLeft, Brain, LogOut, Palette, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/settings/profile", label: "Profile", icon: UserRound },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
  { href: "/settings/memory", label: "Memory", icon: Brain },
] as const;

export function SettingsSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 text-sidebar-foreground">
      <Button asChild variant="ghost" className="mb-2 justify-start gap-2 text-muted-foreground hover:text-foreground">
        <Link href="/">
          <ArrowLeft className="size-4" />
          Back to app
        </Link>
      </Button>

      <p className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Settings</p>
      <nav className="flex flex-col gap-1">
        {SECTIONS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Separator />
        <Button
          variant="ghost"
          onClick={() => void signOut()}
          className="justify-start gap-2 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
