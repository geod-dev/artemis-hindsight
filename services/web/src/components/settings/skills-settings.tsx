"use client";

import type { InstalledSkill } from "@artemis/contracts";
import { Check, Download, ExternalLink, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketplaceSkill } from "@/server/skills/marketplace";
import type { SkillSource } from "@/server/skills/skills-service";

type Loadable<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SkillsSettings() {
  const [installed, setInstalled] = useState<Loadable<InstalledSkill[]>>({ status: "loading" });
  const [sources, setSources] = useState<SkillSource[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<Record<string, Loadable<MarketplaceSkill[]>>>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const loadInstalled = useCallback(async () => {
    try {
      const { skills } = await request<{ skills: InstalledSkill[] }>("/api/skills/installed");
      setInstalled({ status: "ready", data: skills });
    } catch (error) {
      setInstalled({ status: "error", error: errorText(error) });
    }
  }, []);

  const loadCatalog = useCallback(async (repo: string, refresh = false) => {
    setCatalogs((current) => ({ ...current, [repo]: { status: "loading" } }));
    try {
      const params = new URLSearchParams({ repo, ...(refresh ? { refresh: "1" } : {}) });
      const { skills } = await request<{ skills: MarketplaceSkill[] }>(`/api/skills/marketplace?${params}`);
      setCatalogs((current) => ({ ...current, [repo]: { status: "ready", data: skills } }));
    } catch (error) {
      setCatalogs((current) => ({ ...current, [repo]: { status: "error", error: errorText(error) } }));
    }
  }, []);

  useEffect(() => {
    void loadInstalled();
    void request<{ sources: SkillSource[] }>("/api/skills/sources")
      .then(({ sources: list }) => {
        setSources(list);
        setSelected((current) => current ?? list[0]?.repo ?? null);
      })
      .catch((error: unknown) => setActionError(errorText(error)));
  }, [loadInstalled]);

  useEffect(() => {
    if (selected && !catalogs[selected]) void loadCatalog(selected);
  }, [selected, catalogs, loadCatalog]);

  async function run(key: string, action: () => Promise<void>) {
    setBusy((current) => ({ ...current, [key]: true }));
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setBusy((current) => ({ ...current, [key]: false }));
    }
  }

  const install = (repo: string, skill: MarketplaceSkill) =>
    run(`install:${repo}:${skill.path}`, async () => {
      await request("/api/skills/marketplace/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, path: skill.path }),
      });
      await loadInstalled();
    });

  const uninstall = (folder: string) =>
    run(`remove:${folder}`, async () => {
      await request(`/api/skills/installed/${encodeURIComponent(folder)}`, { method: "DELETE" });
      await loadInstalled();
    });

  const addSource = (repo: string) =>
    run("add-source", async () => {
      const source = await request<SkillSource>("/api/skills/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      setSources((current) => (current.some((s) => s.repo === source.repo) ? current : [...current, source]));
      setSelected(source.repo);
    });

  const removeSource = (repo: string) =>
    run(`remove-source:${repo}`, async () => {
      await request(`/api/skills/sources?${new URLSearchParams({ repo })}`, { method: "DELETE" });
      setSources((current) => current.filter((s) => s.repo !== repo));
      setSelected((current) => (current === repo ? (sources[0]?.repo ?? null) : current));
    });

  const installedFolders = useMemo(
    () => new Set(installed.status === "ready" ? installed.data.map((s) => s.folder) : []),
    [installed],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
        <p className="text-sm text-muted-foreground">
          Instructions and scripts Artemis follows for specific tasks. They live in the <code>skills</code> folder of
          your workspace: Artemis can also create and edit them for you.
        </p>
      </header>

      {actionError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{actionError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setActionError(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      <InstalledSection installed={installed} busy={busy} onRemove={(folder) => void uninstall(folder)} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Marketplace</h2>
          <p className="text-sm text-muted-foreground">Skills from GitHub repositories, installed into your own skills.</p>
        </div>

        <SourcePicker
          sources={sources}
          selected={selected}
          busy={busy}
          onSelect={setSelected}
          onAdd={(repo) => void addSource(repo)}
          onRemove={(repo) => void removeSource(repo)}
        />

        {selected && (
          <Catalog
            repo={selected}
            source={sources.find((s) => s.repo === selected)}
            catalog={catalogs[selected] ?? { status: "loading" }}
            query={query}
            onQueryChange={setQuery}
            installedFolders={installedFolders}
            busy={busy}
            onRefresh={() => void loadCatalog(selected, true)}
            onInstall={(skill) => void install(selected, skill)}
          />
        )}
      </section>
    </div>
  );
}

function InstalledSection({
  installed,
  busy,
  onRemove,
}: {
  installed: Loadable<InstalledSkill[]>;
  busy: Record<string, boolean>;
  onRemove: (folder: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Your skills</h2>
        <p className="text-sm text-muted-foreground">Artemis sees these in every new message.</p>
      </div>

      {installed.status === "loading" && <Skeleton className="h-24 w-full rounded-xl" />}
      {installed.status === "error" && <p className="text-sm text-destructive">{installed.error}</p>}
      {installed.status === "ready" && installed.data.length === 0 && (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No skills yet. Install one from a marketplace below, or ask Artemis to create one.
        </p>
      )}
      {installed.status === "ready" && installed.data.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {installed.data.map((skill) => (
            <li key={skill.folder} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{skill.name}</p>
                  {skill.error && <Badge variant="destructive">{skill.error}</Badge>}
                </div>
                {skill.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{skill.description}</p>}
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground/80">skills/{skill.folder}</p>
              </div>
              <RemoveSkillButton name={skill.name} pending={busy[`remove:${skill.folder}`] === true} onConfirm={() => onRemove(skill.folder)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RemoveSkillButton({ name, pending, onConfirm }: { name: string; pending: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} disabled={pending} className="shrink-0 text-muted-foreground hover:text-destructive">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its folder and every file in it are deleted, including the changes Artemis made to it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SourcePicker({
  sources,
  selected,
  busy,
  onSelect,
  onAdd,
  onRemove,
}: {
  sources: SkillSource[];
  selected: string | null;
  busy: Record<string, boolean>;
  onSelect: (repo: string) => void;
  onAdd: (repo: string) => void;
  onRemove: (repo: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const adding = busy["add-source"] === true;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const active = source.repo === selected;
          return (
            <div key={source.repo} className="flex items-center">
              <Button
                size="sm"
                variant={active ? "secondary" : "outline"}
                aria-pressed={active}
                onClick={() => onSelect(source.repo)}
                className={source.builtIn ? "" : "rounded-r-none"}
              >
                {source.repo}
              </Button>
              {!source.builtIn && (
                <Button
                  size="icon-sm"
                  variant={active ? "secondary" : "outline"}
                  aria-label={`Remove marketplace ${source.repo}`}
                  disabled={busy[`remove-source:${source.repo}`] === true}
                  onClick={() => onRemove(source.repo)}
                  className="rounded-l-none border-l-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) {
            onAdd(draft.trim());
            setDraft("");
          }
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a marketplace: owner/repo or GitHub URL"
          aria-label="GitHub repository to add as a marketplace"
          disabled={adding}
        />
        <Button type="submit" variant="outline" disabled={adding || !draft.trim()} className="gap-1.5">
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </form>
    </div>
  );
}

function Catalog({
  repo,
  source,
  catalog,
  query,
  onQueryChange,
  installedFolders,
  busy,
  onRefresh,
  onInstall,
}: {
  repo: string;
  source: SkillSource | undefined;
  catalog: Loadable<MarketplaceSkill[]>;
  query: string;
  onQueryChange: (value: string) => void;
  installedFolders: Set<string>;
  busy: Record<string, boolean>;
  onRefresh: () => void;
  onInstall: (skill: MarketplaceSkill) => void;
}) {
  const needle = query.trim().toLowerCase();
  const skills =
    catalog.status === "ready"
      ? catalog.data.filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle))
      : [];

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium hover:underline"
          >
            {repo}
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
          {source && <p className="text-sm text-muted-foreground">{source.description}</p>}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={onRefresh} disabled={catalog.status === "loading"}>
          <RefreshCw className={catalog.status === "loading" ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search skills"
          aria-label="Search skills"
          className="pl-9"
        />
      </div>

      {catalog.status === "loading" && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}
      {catalog.status === "error" && <p className="text-sm text-destructive">{catalog.error}</p>}
      {catalog.status === "ready" && skills.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {catalog.data.length === 0 ? "This repository has no skill." : "No skill matches your search."}
        </p>
      )}
      {skills.length > 0 && (
        <ul className="-mx-4 divide-y border-t">
          {skills.map((skill) => {
            const isInstalled = installedFolders.has(skill.folder);
            const pending = busy[`install:${repo}:${skill.path}`] === true;
            return (
              <li key={skill.path} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{skill.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{skill.description}</p>
                  {skill.path && <p className="mt-1 truncate font-mono text-xs text-muted-foreground/80">{skill.path}</p>}
                </div>
                {isInstalled ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        title="Download it again, replacing your copy"
                        className="shrink-0 gap-1.5 text-muted-foreground"
                      >
                        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        {pending ? "Updating…" : "Installed"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Update {skill.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your skills/{skill.folder} folder is replaced with the version from {repo}. Changes made to it
                          are lost.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onInstall(skill)}>Update</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => onInstall(skill)} className="shrink-0 gap-1.5">
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {pending ? "Installing…" : "Install"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
