import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { MAX_SKILL_BYTES, parseSkillFrontmatter, type InstalledSkill, type SkillInstallRequest } from "@artemis/contracts";
import { workspaceDir, type Roots } from "./paths.js";

// A user's skills: <workspace>/<username>/skills/<folder>/SKILL.md. The agent creates and edits them with its own
// tools; these functions list them for the web app and install or remove a whole folder. The username and folder name
// are validated by the caller.

export class SkillError extends Error {}

export function skillsDir(roots: Roots, username: string): string {
  return path.join(workspaceDir(roots, username), "skills");
}

/** Every folder in the user's skills folder, sorted by name. A folder without a usable SKILL.md has an error. */
export async function listSkills(roots: Roots, username: string): Promise<InstalledSkill[]> {
  const root = skillsDir(roots, username);
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(async (entry): Promise<InstalledSkill> => {
        const skillPath = path.join(root, entry.name, "SKILL.md");
        let markdown: string;
        try {
          markdown = await fs.readFile(skillPath, "utf8");
        } catch {
          return { folder: entry.name, name: entry.name, description: "", path: skillPath, error: "no SKILL.md" };
        }
        const { name, description } = parseSkillFrontmatter(markdown);
        return {
          folder: entry.name,
          name: name ?? entry.name,
          description: description ?? "",
          path: skillPath,
          ...(description ? {} : { error: "SKILL.md has no description in its frontmatter" }),
        };
      }),
  );
  return skills.sort((a, b) => a.folder.localeCompare(b.folder));
}

/**
 * Writes a skill folder, replacing the one with the same name. The files go to a temporary folder first, so a failed
 * install leaves the previous version in place.
 */
export async function installSkill(
  roots: Roots,
  username: string,
  folder: string,
  request: SkillInstallRequest,
): Promise<InstalledSkill> {
  const files = request.files.map((file) => ({ path: file.path, bytes: Buffer.from(file.base64, "base64") }));
  const total = files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (total > MAX_SKILL_BYTES) throw new SkillError(`the skill is larger than ${MAX_SKILL_BYTES / 1024 / 1024} MB`);

  const root = skillsDir(roots, username);
  const target = path.join(root, folder);
  const staging = path.join(root, `.installing-${randomUUID()}`);
  const previous = path.join(root, `.removing-${randomUUID()}`);
  await fs.mkdir(staging, { recursive: true });
  try {
    for (const file of files) {
      const destination = path.join(staging, ...file.path.split("/"));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, file.bytes);
    }
    const hadPrevious = await fs.rename(target, previous).then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw error;
      },
    );
    await fs.rename(staging, target);
    if (hadPrevious) await fs.rm(previous, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    throw error;
  }

  const installed = (await listSkills(roots, username)).find((skill) => skill.folder === folder);
  if (!installed) throw new SkillError("the skill was written but could not be read back");
  return installed;
}

/** Removes a skill folder and everything in it. Returns false when there was no such skill. */
export async function removeSkill(roots: Roots, username: string, folder: string): Promise<boolean> {
  const target = path.join(skillsDir(roots, username), folder);
  try {
    await fs.access(target);
  } catch {
    return false;
  }
  await fs.rm(target, { recursive: true, force: true });
  return true;
}
