"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MemoryDetail, MemoryRef } from "@/lib/memory-explorer";
import type { DetailNavigation } from "./detail-dialog";
import { CopyValue, DetailSkeleton, Facts, PanelMessage, RefList, RefRow, Section, TypeTag, ColorDot } from "./memory-parts";
import { ENTITY_TOKEN, formatDateTime, formatOccurred, splitMemoryText } from "./memory-style";
import { useJson } from "./use-json";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One memory: its text, dates, entities, sources and history. Facts can be forgotten from here. */
export function MemoryDetailView({ id, navigation }: { id: string; navigation: DetailNavigation }) {
  const state = useJson<MemoryDetail>(`/api/memory/${encodeURIComponent(id)}`);

  if (state.status === "loading") {
    return (
      <>
        <DialogTitle className="sr-only">Loading memory</DialogTitle>
        <DetailSkeleton />
      </>
    );
  }
  if (state.status === "error") {
    return (
      <>
        <DialogTitle className="sr-only">Memory</DialogTitle>
        <PanelMessage>This memory could not be loaded: {state.message}.</PanelMessage>
      </>
    );
  }

  const memory = state.data;
  const { sentences, tags } = splitMemoryText(memory.text);
  const [headline, ...rest] = sentences;
  const openRef = (ref: MemoryRef) =>
    navigation.open(ref.type === "mental_model" ? { kind: "mental_model", id: ref.id } : { kind: "memory", id: ref.id });
  const forgotten = memory.state !== "valid";

  return (
    <div className="flex flex-col gap-6">
      <DialogHeader className="gap-3 pr-6 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <TypeTag type={memory.type} />
          {forgotten && <Badge variant="outline">Forgotten</Badge>}
        </div>
        <DialogTitle className="text-base leading-relaxed font-medium">{headline ?? memory.text}</DialogTitle>
        {rest.map((sentence, index) => (
          <p key={index} className="text-sm leading-relaxed text-muted-foreground">
            {sentence}
          </p>
        ))}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="font-normal">
                <span className="text-muted-foreground">{tag.key}:</span>
                {tag.value}
              </Badge>
            ))}
          </div>
        )}
      </DialogHeader>

      {memory.entities.length > 0 && (
        <Section title="Entities" count={memory.entities.length}>
          <div className="flex flex-wrap gap-1.5">
            {memory.entities.map((entity) =>
              entity.id ? (
                <Button
                  key={entity.name}
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-2.5 font-normal"
                  onClick={() => navigation.open({ kind: "entity", id: entity.id as string })}
                >
                  <ColorDot token={ENTITY_TOKEN} className="size-1.5" />
                  {entity.name}
                </Button>
              ) : (
                <Badge key={entity.name} variant="outline" className="h-7 rounded-full px-2.5 font-normal">
                  {entity.name}
                </Badge>
              ),
            )}
          </div>
        </Section>
      )}

      {memory.sources.length > 0 && (
        <Section title="Built from" count={memory.sources.length}>
          <RefList items={memory.sources} onOpen={openRef} />
        </Section>
      )}

      {memory.history.length > 0 && (
        <Section title="History" count={memory.history.length}>
          <ol className="flex flex-col gap-4 border-l pl-4">
            {memory.history.map((change) => (
              <li key={change.changedAt} className="relative flex flex-col gap-1.5">
                <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-border" />
                <p className="text-xs text-muted-foreground">Updated {formatDateTime(change.changedAt)}</p>
                {change.previousText && (
                  <p className="text-sm leading-relaxed">
                    <span className="text-muted-foreground">Before: </span>
                    {change.previousText}
                  </p>
                )}
                {change.sources.some((source) => source.isNew) && (
                  <div className="-mx-2.5 flex flex-col">
                    {change.sources
                      .filter((source) => source.isNew)
                      .map((source) => (
                        <RefRow
                          key={source.id}
                          item={source}
                          onOpen={openRef}
                          badge={<Badge variant="secondary" className="mt-0.5 font-normal">New fact</Badge>}
                        />
                      ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="Details">
        <Facts
          rows={[
            { label: "Mentioned", value: formatDateTime(memory.mentionedAt) },
            { label: "Happened", value: formatOccurred(memory.occurredStart, memory.occurredEnd) },
            { label: "Consolidated", value: formatDateTime(memory.consolidatedAt) },
            { label: "Edited", value: formatDateTime(memory.editedAt) },
            {
              label: "Forgotten",
              value: memory.invalidatedAt
                ? [formatDateTime(memory.invalidatedAt), memory.invalidationReason].filter(Boolean).join(" · ")
                : null,
            },
            { label: "Context", value: memory.context },
            { label: "Tags", value: memory.tags.length > 0 ? memory.tags.join(", ") : null },
            {
              label: "Conversation",
              value:
                memory.documentId && UUID.test(memory.documentId) ? (
                  <Link
                    href={`/c/${memory.documentId}`}
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    Open conversation
                    <ExternalLink className="size-3.5" />
                  </Link>
                ) : null,
            },
            { label: "Document", value: memory.documentId ? <CopyValue value={memory.documentId} label="Copy document id" /> : null },
            { label: "Chunk", value: memory.chunkId ? <CopyValue value={memory.chunkId} label="Copy chunk id" /> : null },
            { label: "ID", value: <CopyValue value={memory.id} label="Copy memory id" /> },
          ]}
        />
      </Section>

      {(memory.type === "world" || memory.type === "experience") && !forgotten && (
        <ForgetMemory id={memory.id} navigation={navigation} />
      )}
    </div>
  );
}

/** Forgets a fact. Observations are derived from facts, so only facts can be forgotten one by one. */
function ForgetMemory({ id, navigation }: { id: string; navigation: DetailNavigation }) {
  const [open, setOpen] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function forget() {
    setForgetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      navigation.changed();
      navigation.leave();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setForgetting(false);
    }
  }

  return (
    <div className="flex justify-end border-t pt-4">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (forgetting) return;
          setOpen(next);
          if (!next) setError(null);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 />
            Forget this memory
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>Artemis will forget this memory. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">It could not be forgotten: {error}.</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={forgetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={forgetting}
              onClick={(event) => {
                event.preventDefault();
                void forget();
              }}
            >
              {forgetting ? "Forgetting…" : "Forget"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
