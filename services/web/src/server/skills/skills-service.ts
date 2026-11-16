import { skillFolderSchema, type InstalledSkill } from "@artemis/contracts";
import { installSkill, listSkills, removeSkill } from "../clients/toolbox-client";
import { getSkillSources, setSkillSources } from "../repositories/user-repository";
import { downloadMarketplaceSkill, listMarketplaceSkills, MarketplaceError, parseRepo, type MarketplaceSkill } from "./marketplace";

// A user's skills and the marketplaces they install them from. Skills are personal: they live in the user's workspace
// (<workspace>/<username>/skills), and the agent can read, edit and create them there.

export class SkillServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface SkillSource {
  repo: string;
  description: string;
  /** Built-in sources are listed for everyone and cannot be removed. */
  builtIn: boolean;
}

/** Well-known GitHub repositories of skills in Claude's format, offered to every user. */
export const BUILT_IN_SOURCES: readonly SkillSource[] = [
  { repo: "anthropics/skills", description: "Anthropic's skills: documents, design, writing", builtIn: true },
  { repo: "openai/skills", description: "OpenAI's skill catalog", builtIn: true },
  { repo: "huggingface/skills", description: "Models, datasets and the Hugging Face Hub", builtIn: true },
  { repo: "vercel-labs/agent-skills", description: "Web development with React and Next.js", builtIn: true },
  { repo: "obra/superpowers", description: "Software development workflows", builtIn: true },
  { repo: "K-Dense-AI/claude-scientific-skills", description: "Science: biology, chemistry, data analysis", builtIn: true },
];

const MAX_CUSTOM_SOURCES = 20;

export async function listSources(userId: string): Promise<SkillSource[]> {
  const builtIn = new Set(BUILT_IN_SOURCES.map((s) => s.repo.toLowerCase()));
  const custom = (await getSkillSources(userId))
    .filter((repo) => !builtIn.has(repo.toLowerCase()))
    .map((repo) => ({ repo, description: "Added by you", builtIn: false }));
  return [...BUILT_IN_SOURCES, ...custom];
}

/** Adds a GitHub repository as a marketplace, after checking it has at least one skill. */
export async function addSource(userId: string, input: unknown): Promise<SkillSource> {
  const repo = typeof input === "string" ? parseRepo(input) : null;
  if (!repo) throw new SkillServiceError("enter a GitHub repository as owner/repo or its URL", 400);

  const sources = await listSources(userId);
  const existing = sources.find((s) => s.repo.toLowerCase() === repo.toLowerCase());
  if (existing) return existing;
  if (sources.filter((s) => !s.builtIn).length >= MAX_CUSTOM_SOURCES) {
    throw new SkillServiceError(`you can add up to ${MAX_CUSTOM_SOURCES} marketplaces`, 400);
  }

  const skills = await withMarketplaceErrors(() => listMarketplaceSkills(repo));
  if (skills.length === 0) throw new SkillServiceError(`${repo} has no skill (no folder with a SKILL.md)`, 422);

  const custom = await getSkillSources(userId);
  await setSkillSources(userId, [...custom, repo]);
  return { repo, description: "Added by you", builtIn: false };
}

export async function removeSource(userId: string, input: unknown): Promise<void> {
  const repo = typeof input === "string" ? parseRepo(input) : null;
  if (!repo) throw new SkillServiceError("invalid repository", 400);
  if (BUILT_IN_SOURCES.some((s) => s.repo.toLowerCase() === repo.toLowerCase())) {
    throw new SkillServiceError("built-in marketplaces cannot be removed", 400);
  }
  const custom = await getSkillSources(userId);
  await setSkillSources(
    userId,
    custom.filter((r) => r.toLowerCase() !== repo.toLowerCase()),
  );
}

export async function browseSource(input: unknown, refresh: boolean): Promise<MarketplaceSkill[]> {
  const repo = typeof input === "string" ? parseRepo(input) : null;
  if (!repo) throw new SkillServiceError("invalid repository", 400);
  return withMarketplaceErrors(() => listMarketplaceSkills(repo, refresh));
}

/** Downloads a marketplace skill into the user's skills folder, replacing a skill with the same folder name. */
export async function installFromMarketplace(username: string, input: unknown, skillPath: unknown): Promise<InstalledSkill> {
  const repo = typeof input === "string" ? parseRepo(input) : null;
  if (!repo || typeof skillPath !== "string") throw new SkillServiceError("a repository and a skill path are required", 400);
  const { skill, request } = await withMarketplaceErrors(() => downloadMarketplaceSkill(repo, skillPath));
  return installSkill(username, skill.folder, request);
}

export async function listInstalled(username: string): Promise<InstalledSkill[]> {
  return listSkills(username);
}

export async function uninstall(username: string, folder: string): Promise<void> {
  const parsed = skillFolderSchema.safeParse(folder);
  if (!parsed.success) throw new SkillServiceError("invalid skill name", 400);
  if (!(await removeSkill(username, parsed.data))) throw new SkillServiceError("no such skill", 404);
}

async function withMarketplaceErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof MarketplaceError) throw new SkillServiceError(error.message, error.status);
    throw error;
  }
}
