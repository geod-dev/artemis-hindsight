import { parse as parseYaml } from "yaml";
import { z } from "zod";

// Skills, in Claude's format: a folder with a SKILL.md whose YAML frontmatter has a `name` and a `description`, then
// instructions, and optional scripts and reference files next to it. Each user's skills live in
// <workspace>/<username>/skills/<folder>/. The agent reads them with its file tools; the web app lists, installs and
// removes them through the toolbox.

/** The name of a skill's folder. Also the name the web app installs a marketplace skill under. */
export const skillFolderSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, "skill name must be 1-64 characters: letters, digits, '.', '_' or '-'");

/** A path inside a skill folder: relative, with forward slashes and no "." or ".." segment. */
export const skillFilePathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (value) => !value.startsWith("/") && !value.includes("\\") && value.split("/").every((s) => s !== "" && s !== "." && s !== ".."),
    "file path must be relative, with no '.' or '..' segment",
  );

export const MAX_SKILL_FILES = 300;
export const MAX_SKILL_BYTES = 25 * 1024 * 1024;

export const installedSkillSchema = z.object({
  /** The folder name. */
  folder: z.string(),
  /** The frontmatter name, or the folder name when the frontmatter has none. */
  name: z.string(),
  description: z.string(),
  /** Absolute path of the SKILL.md in the sandbox. */
  path: z.string(),
  /** Why the skill cannot be used, when its SKILL.md is missing or has no description. */
  error: z.string().optional(),
});
export type InstalledSkill = z.infer<typeof installedSkillSchema>;

export const installedSkillListSchema = z.object({ skills: z.array(installedSkillSchema) });

export const skillInstallRequestSchema = z.object({
  files: z
    .array(z.object({ path: skillFilePathSchema, base64: z.string() }))
    .min(1)
    .max(MAX_SKILL_FILES)
    .refine((files) => files.some((f) => f.path === "SKILL.md"), "a skill needs a SKILL.md at its root"),
});
export type SkillInstallRequest = z.infer<typeof skillInstallRequestSchema>;

export interface SkillFrontmatter {
  name?: string;
  description?: string;
}

/**
 * Reads the `name` and `description` from a SKILL.md's YAML frontmatter. Returns an empty object when there is no
 * frontmatter or it is not valid YAML.
 */
export function parseSkillFrontmatter(markdown: string): SkillFrontmatter {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match?.[1]) return {};
  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null) return {};
  const { name, description } = data as Record<string, unknown>;
  return {
    ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
    ...(typeof description === "string" && description.trim() ? { description: description.trim() } : {}),
  };
}
