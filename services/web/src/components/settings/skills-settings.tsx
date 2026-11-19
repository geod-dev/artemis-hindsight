"use client";

import type { InstalledSkill } from "@artemis/contracts";
import { Check, Download, ExternalLink, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketplaceSkill } from "@/server/skills/marketplace";
import { SettingsList, SettingsPage, SettingsRow } from "./settings-page";
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
  const [tab, setTab] = useState<"mine" | "marketplace">("mine");

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

  // Every marketplace is read, not only the open one: "Your skills" offers an update for any skill one of them provides.
  useEffect(() => {
    for (const source of sources) if (!catalogs[source.repo]) void loadCatalog(source.repo);
  }, [sources, catalogs, loadCatalog]);

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

  // Where an installed skill can be updated from: the first marketplace (in the sources' order) with the same folder.
  // A skill Artemis created matches none, so it has no update.
  const updates = useMemo(() => {
    const found = new Map<string, { repo: string; skill: MarketplaceSkill }>();
    for (const source of sources) {
      const catalog = catalogs[source.repo];
      if (catalog?.status !== "ready") continue;
      for (const skill of catalog.data) if (!found.has(skill.folder)) found.set(skill.folder, { repo: source.repo, skill });
    }
    return found;
  }, [sources, catalogs]);

  return (
    <SettingsPage title="Skills" description="Teach Artemis how you like things done. Just ask it to create or change one.">
      {actionError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{actionError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setActionError(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value === "marketplace" ? "marketplace" : "mine")} className="gap-8">
        <TabsList>
          <TabsTrigger value="mine">
            Your skills
            {installed.status === "ready" && (
              <span className="text-xs text-muted-foreground tabular-nums">{installed.data.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          <InstalledSection
            installed={installed}
            updates={updates}
            busy={busy}
            onUpdate={(repo, skill) => void install(repo, skill)}
            onRemove={(folder) => void uninstall(folder)}
          />
        </TabsContent>

        <TabsContent value="marketplace" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Skills from GitHub repositories, installed into your own skills.</p>

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
              onShowInstalled={() => setTab("mine")}
            />
          )}
        </TabsContent>
      </Tabs>
    </SettingsPage>
  );
}

function InstalledSection({
  installed,
  updates,
  busy,
  onUpdate,
  onRemove,
}: {
  installed: Loadable<InstalledSkill[]>;
  updates: Map<string, { repo: string; skill: MarketplaceSkill }>;
  busy: Record<string, boolean>;
  onUpdate: (repo: string, skill: MarketplaceSkill) => void;
  onRemove: (folder: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Artemis sees these in every new message.</p>

      {installed.status === "loading" && <Skeleton className="h-24 w-full rounded-xl" />}
      {installed.status === "error" && <p className="text-sm text-destructive">{installed.error}</p>}
      {installed.status === "ready" && installed.data.length === 0 && (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No skills yet. Install one from the Marketplace tab, or ask Artemis to create one.
        </p>
      )}
      {installed.status === "ready" && installed.data.length > 0 && (
        <SettingsList>
          {installed.data.map((skill) => {
            const update = updates.get(skill.folder);
            const updating = update !== undefined && busy[`install:${update.repo}:${update.skill.path}`] === true;
            return (
              <SettingsRow
                key={skill.folder}
                title={skill.name}
                badges={skill.error && <Badge variant="destructive">{skill.error}</Badge>}
                description={skill.description}
                detail={`skills/${skill.folder}`}
                actions={
                  <>
                    {update && (
                      <ConfirmUpdate name={skill.name} folder={skill.folder} repo={update.repo} onConfirm={() => onUpdate(update.repo, update.skill)}>
                        <Button size="sm" variant="outline" disabled={updating}>
                          {updating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                          {updating ? "Updating…" : "Update"}
                        </Button>
                      </ConfirmUpdate>
                    )}
                    <RemoveSkillButton name={skill.name} pending={busy[`remove:${skill.folder}`] === true} onConfirm={() => onRemove(skill.folder)} />
                  </>
                }
              />
            );
          })}
        </SettingsList>
      )}
    </section>
  );
}

/** Asks before an update: the installed folder is replaced by the marketplace's version. `children` is the trigger. */
function ConfirmUpdate({
  name,
  folder,
  repo,
  onConfirm,
  children,
}: {
  name: string;
  folder: string;
  repo: string;
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Update {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Your skills/{folder} folder is replaced with the version from {repo}. Changes made to it are lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Update</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RemoveSkillButton({ name, pending, onConfirm }: { name: string; pending: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline-destructive" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {pending ? "Removing…" : "Remove"}
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
  const adding = busy["add-source"] === true;

  return (
    <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const active = source.repo === selected;
          return (
            <div key={source.repo} className="flex items-center">
              <Button
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => onSelect(source.repo)}
                className={source.builtIn ? "" : "rounded-r-none"}
              >
                {source.repo}
              </Button>
              {!source.builtIn && (
                <Button
                  size="icon-sm"
                  variant={active ? "default" : "outline"}
                  aria-label={`Remove marketplace ${source.repo}`}
                  disabled={busy[`remove-source:${source.repo}`] === true}
                  onClick={() => onRemove(source.repo)}
                  className={active ? "rounded-l-none border-l-0" : "rounded-l-none border-l-0 text-muted-foreground hover:text-destructive"}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      <AddSourceDialog adding={adding} onAdd={onAdd} />
    </div>
  );
}

/** The "+" after the marketplaces: a dialog asks for the GitHub repository. Errors show in the page's alert. */
function AddSourceDialog({ adding, onAdd }: { adding: boolean; onAdd: (repo: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft("");
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="outline" aria-label="Add a marketplace" disabled={adding}>
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            onAdd(draft.trim());
            setOpen(false);
            setDraft("");
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a marketplace</DialogTitle>
            <DialogDescription>A GitHub repository with skills in it.</DialogDescription>
          </DialogHeader>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="owner/repo or GitHub URL"
            aria-label="GitHub repository"
            autoFocus
          />
          <DialogFooter>
            <Button type="submit" disabled={!draft.trim()}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  onShowInstalled,
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
  onShowInstalled: () => void;
}) {
  const needle = query.trim().toLowerCase();
  const skills =
    catalog.status === "ready"
      ? catalog.data.filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle))
      : [];

  return (
    <div className="flex flex-col gap-3">
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
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}
      {catalog.status === "error" && <p className="text-sm text-destructive">{catalog.error}</p>}
      {catalog.status === "ready" && skills.length === 0 && (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {catalog.data.length === 0 ? "This repository has no skill." : "No skill matches your search."}
        </p>
      )}
      {skills.length > 0 && (
        <SettingsList>
          {skills.map((skill) => {
            const isInstalled = installedFolders.has(skill.folder);
            const pending = busy[`install:${repo}:${skill.path}`] === true;
            return (
              <SettingsRow
                key={skill.path}
                title={skill.name}
                description={skill.description}
                detail={skill.path || undefined}
                actions={
                  isInstalled ? (
                    <Button size="sm" variant="ghost" disabled={pending} title="See it in your skills" onClick={onShowInstalled}>
                      {pending ? <Loader2 className="animate-spin" /> : <Check />}
                      {pending ? "Updating…" : "Installed"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => onInstall(skill)}>
                      {pending ? <Loader2 className="animate-spin" /> : <Download />}
                      {pending ? "Installing…" : "Install"}
                    </Button>
                  )
                }
              />
            );
          })}
        </SettingsList>
      )}
    </div>
  );
}
