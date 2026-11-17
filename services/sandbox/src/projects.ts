import { promises as fs } from "node:fs";
import path from "node:path";
import { MAX_PROJECT_ICON_BYTES, PROJECT_ICON_EXTENSIONS } from "@artemis/contracts";
import { projectDir, type Roots } from "./paths.js";

// A project's folder lives in the user's workspace. Its icon is the single file icon.<ext> at the top of the folder.
// The usernames and project ids are validated by the caller.

/** A rule the caller broke, such as an icon of the wrong type. The message is safe to show to the user. */
export class ProjectError extends Error {}

const EXTENSION_TO_MEDIA_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(PROJECT_ICON_EXTENSIONS).map(([mediaType, extension]) => [extension, mediaType]),
);

const ICON_FILE = /^icon\.[a-z]+$/;

export async function ensureProject(roots: Roots, username: string, projectId: string): Promise<void> {
  await fs.mkdir(projectDir(roots, username, projectId), { recursive: true });
}

export async function removeProject(roots: Roots, username: string, projectId: string): Promise<void> {
  await fs.rm(projectDir(roots, username, projectId), { recursive: true, force: true });
}

/** Stores the icon as icon.<ext>, replacing any icon the project had before. Returns the file name. */
export async function saveProjectIcon(
  roots: Roots,
  username: string,
  projectId: string,
  bytes: Buffer,
  mediaType: string,
): Promise<string> {
  const extension = PROJECT_ICON_EXTENSIONS[mediaType];
  if (!extension) throw new ProjectError("the icon must be a PNG, JPEG, WebP or GIF image");
  if (bytes.byteLength === 0) throw new ProjectError("the icon is empty");
  if (bytes.byteLength > MAX_PROJECT_ICON_BYTES) throw new ProjectError("the icon must be 2 MB or smaller");

  const dir = projectDir(roots, username, projectId);
  await fs.mkdir(dir, { recursive: true });
  await removeIconFiles(dir);
  const name = `icon.${extension}`;
  await fs.writeFile(path.join(dir, name), bytes);
  return name;
}

/** The project's icon, or null when it has none. */
export async function readProjectIcon(
  roots: Roots,
  username: string,
  projectId: string,
): Promise<{ bytes: Buffer; mediaType: string; name: string } | null> {
  const dir = projectDir(roots, username, projectId);
  const name = (await iconFilesIn(dir))[0];
  if (!name) return null;
  const mediaType = EXTENSION_TO_MEDIA_TYPE[path.extname(name).slice(1)] ?? "application/octet-stream";
  return { bytes: await fs.readFile(path.join(dir, name)), mediaType, name };
}

export async function removeProjectIcon(roots: Roots, username: string, projectId: string): Promise<void> {
  await removeIconFiles(projectDir(roots, username, projectId));
}

async function iconFilesIn(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries.filter((entry) => ICON_FILE.test(entry));
}

async function removeIconFiles(dir: string): Promise<void> {
  for (const name of await iconFilesIn(dir)) {
    await fs.rm(path.join(dir, name), { force: true });
  }
}
