"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { onListsChanged } from "@/lib/list-events";
import type { ConversationSummary } from "@/lib/projects";
import { ConversationRowContent } from "@/components/conversations/conversation-row-content";

const FIRST_PAGE = 4;
const PAGE_STEP = 10;

interface Page {
  key: string;
  conversations: ConversationSummary[];
  total: number;
}

/**
 * The recent conversations of the selected project, under the new chat's composer. Four at first; "See more" adds
 * ten at a time. The list is fetched for each project and each size, so a switch never shows the previous project.
 * It is read again whenever a list changes (a conversation moved here, or a change made in another window): the shown
 * list stays until the new one arrives.
 */
export function ProjectRecents({ projectId }: { projectId: string }) {
  const [limit, setLimit] = useState(FIRST_PAGE);
  const [page, setPage] = useState<Page | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  // Identifies one request: a page of one project. A response or a failure only applies to its own request.
  const key = `${projectId}:${limit}`;

  useEffect(() => onListsChanged(() => setRevision((value) => value + 1)), []);

  useEffect(() => {
    const controller = new AbortController();
    const requested = `${projectId}:${limit}`;
    const url = `/api/projects/${encodeURIComponent(projectId)}/conversations?limit=${limit}&offset=0`;
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ conversations: ConversationSummary[]; total: number }>;
      })
      .then((data) => {
        setPage({ key: requested, conversations: data.conversations, total: data.total });
        setFailedKey(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(requested);
      });
    return () => controller.abort();
  }, [projectId, limit, revision]);

  const current = page?.key === key ? page : null;

  return (
    <section aria-label="Recent conversations in this project" className="flex w-full flex-col gap-1">
      <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">Recents</h2>

      {current ? (
        current.conversations.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No conversations in this project yet.</p>
        ) : (
          <ul className="flex flex-col">
            {current.conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/c/${conversation.id}`}
                  className="flex items-center gap-4 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ConversationRowContent
                    title={conversation.title}
                    project={conversation.project}
                    unread={conversation.unread}
                    running={conversation.running}
                    meta={
                      <time dateTime={conversation.updatedAt} className="shrink-0 text-xs text-muted-foreground">
                        {formatDay(conversation.updatedAt)}
                      </time>
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : failedKey === key ? (
        <p className="px-2 py-1.5 text-sm text-destructive">The conversations could not be loaded.</p>
      ) : (
        <div className="flex flex-col gap-2 px-2 py-1.5" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {current && current.conversations.length < current.total && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => setLimit((value) => value + PAGE_STEP)}
        >
          See more
        </Button>
      )}
    </section>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(iso));
}
