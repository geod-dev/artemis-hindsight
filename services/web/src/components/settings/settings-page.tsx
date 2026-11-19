import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The frame of every settings page: one content width, one padding, one header, one spacing between sections.
 * A settings page never sets its own width or padding: it renders this.
 *
 *  - `back`: a link above the title, for a sub-page.
 *  - `actions`: buttons on the right of the title.
 *  - `fill`: the content takes the remaining height (a graph).
 */
export function SettingsPage({
  title,
  description,
  back,
  actions,
  fill = false,
  children,
}: {
  title: string;
  description: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-8 px-6 py-10", fill && "h-full min-h-0")}>
      <header className="flex flex-col gap-2">
        {back && (
          <Button asChild variant="link" className="h-auto w-fit gap-1.5 p-0 font-normal text-muted-foreground">
            <Link href={back.href}>
              <ArrowLeft />
              {back.label}
            </Link>
          </Button>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
}

/** The card that holds the rows of a settings page. */
export function SettingsList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">{children}</ul>;
}

/**
 * One row of a SettingsList: what it is on the left, its buttons on the right.
 *
 *  - `title`: text or a link; `badges` sit beside it.
 *  - `description`: one or two lines under the title.
 *  - `detail`: a small mono line under them (a path).
 *  - `actions`: the buttons, stacked when there are several.
 *  - `note`: a line under the whole row (what an action just did).
 *  - `destructive`: the title in the destructive colour.
 */
export function SettingsRow({
  title,
  badges,
  description,
  detail,
  actions,
  note,
  destructive = false,
}: {
  title: ReactNode;
  badges?: ReactNode;
  description?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <li className="flex flex-col gap-2 px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className={cn("truncate text-sm font-medium", destructive && "text-destructive")}>{title}</h3>
            {badges}
          </div>
          {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}
          {detail && <p className="truncate font-mono text-xs text-muted-foreground/80">{detail}</p>}
        </div>
        {/* Stacked and stretched: several buttons share one width, so they line up. */}
        {actions && <div className="flex shrink-0 flex-col items-stretch gap-1.5">{actions}</div>}
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </li>
  );
}
