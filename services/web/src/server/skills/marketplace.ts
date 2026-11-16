import {
  MAX_SKILL_BYTES,
  MAX_SKILL_FILES,
  parseSkillFrontmatter,
  skillFolderSchema,
  type SkillInstallRequest,
} from "@artemis/contracts";
import { getConfig } from "../config";

// Skill marketplaces are GitHub repositories. Any folder in the repository with a SKILL.md is a skill, which is how
// anthropics/skills and the other well-known repositories are laid out. One GitHub API call lists a repository (its
// tree); the files themselves come from raw.githubusercontent.com, which the API rate limit does not count.

export class MarketplaceError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export interface MarketplaceSkill {
  /** The folder name, which is also the name it is installed under. */
  folder: string;
  name: string;
  description: string;
  /** The skill's folder in the repository ("" when the repository itself is the skill). */
  path: string;
}

interface TreeEntry {
  path: string;
  type: string;
  mode: string;
  size?: number;
}

interface SourceListing {
  fetchedAt: number;
  tree: TreeEntry[];
  skills: MarketplaceSkill[];
}

const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const CACHE_MS = 60 * 60 * 1000;
const FETCH_CONCURRENCY = 8;

const cache = new Map<string, SourceListing>();
const pending = new Map<string, Promise<SourceListing>>();

/** Reads "owner/repo" or a GitHub URL. Returns null when it is neither. */
export function parseRepo(input: string): string | null {
  const trimmed = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const [owner, repo] = trimmed.split("/");
  const candidate = owner && repo ? `${owner}/${repo}` : "";
  return REPO_PATTERN.test(candidate) ? candidate : null;
}

/** The skills in a repository, sorted by name. Cached for an hour. */
export async function listMarketplaceSkills(repo: string, refresh = false): Promise<MarketplaceSkill[]> {
  return (await loadSource(repo, refresh)).skills;
}

/** Downloads a skill's folder from a repository, ready to install under its folder name. */
export async function downloadMarketplaceSkill(
  repo: string,
  skillPath: string,
): Promise<{ skill: MarketplaceSkill; request: SkillInstallRequest }> {
  const source = await loadSource(repo, false);
  const skill = source.skills.find((s) => s.path === skillPath);
  if (!skill) throw new MarketplaceError("no such skill in this repository", 404);

  const prefix = skill.path ? `${skill.path}/` : "";
  // Regular files only: symlinks (mode 120000) and submodules ("commit" entries) are skipped.
  const blobs = source.tree.filter((e) => e.type === "blob" && e.mode !== "120000" && e.path.startsWith(prefix));
  if (blobs.length > MAX_SKILL_FILES) throw new MarketplaceError(`the skill has more than ${MAX_SKILL_FILES} files`, 422);
  const declared = blobs.reduce((sum, e) => sum + (e.size ?? 0), 0);
  if (declared > MAX_SKILL_BYTES) {
    throw new MarketplaceError(`the skill is larger than ${MAX_SKILL_BYTES / 1024 / 1024} MB`, 422);
  }

  const files = await mapLimit(blobs, FETCH_CONCURRENCY, async (entry) => ({
    path: entry.path.slice(prefix.length),
    base64: Buffer.from(await fetchRaw(repo, entry.path)).toString("base64"),
  }));
  return { skill, request: { files } };
}

async function loadSource(repo: string, refresh: boolean): Promise<SourceListing> {
  const cached = cache.get(repo);
  if (cached && !refresh && Date.now() - cached.fetchedAt < CACHE_MS) return cached;
  const inFlight = pending.get(repo);
  if (inFlight) return inFlight;

  const load = (async () => {
    const tree = await fetchTree(repo);
    const repoName = repo.split("/")[1] ?? repo;
    const skillFiles = tree.filter((e) => e.type === "blob" && (e.path === "SKILL.md" || e.path.endsWith("/SKILL.md")));
    const skills = await mapLimit(skillFiles, FETCH_CONCURRENCY, async (entry): Promise<MarketplaceSkill | null> => {
      const dir = entry.path === "SKILL.md" ? "" : entry.path.slice(0, -"/SKILL.md".length);
      const folder = dir ? (dir.split("/").pop() ?? dir) : repoName;
      if (!skillFolderSchema.safeParse(folder).success) return null;
      let frontmatter;
      try {
        frontmatter = parseSkillFrontmatter(new TextDecoder().decode(await fetchRaw(repo, entry.path)));
      } catch {
        return null;
      }
      // A SKILL.md without a description is not a skill the agent could pick: templates, examples and drafts.
      if (!frontmatter.description) return null;
      return { folder, name: frontmatter.name ?? folder, description: frontmatter.description, path: dir };
    });
    const listing: SourceListing = {
      fetchedAt: Date.now(),
      tree,
      skills: skills.filter((s): s is MarketplaceSkill => s !== null).sort((a, b) => a.name.localeCompare(b.name)),
    };
    cache.set(repo, listing);
    return listing;
  })();

  pending.set(repo, load);
  try {
    return await load;
  } finally {
    pending.delete(repo);
  }
}

async function fetchTree(repo: string): Promise<TreeEntry[]> {
  const token = getConfig().GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "artemis-hindsight",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) throw new MarketplaceError(`GitHub repository ${repo} was not found`, 404);
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new MarketplaceError("GitHub's rate limit is reached; try again in a while", 429);
  }
  if (!res.ok) throw new MarketplaceError(`GitHub answered HTTP ${res.status} for ${repo}`);
  const body = (await res.json()) as { tree?: TreeEntry[]; truncated?: boolean };
  if (body.truncated) console.warn("GitHub tree truncated; some skills may be missing", { repo });
  return body.tree ?? [];
}

async function fetchRaw(repo: string, filePath: string): Promise<ArrayBuffer> {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${encoded}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new MarketplaceError(`could not download ${filePath} (HTTP ${res.status})`);
  return res.arrayBuffer();
}

async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
