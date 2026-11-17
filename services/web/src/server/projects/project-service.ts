import { MAX_PROJECT_ICON_BYTES, PROJECT_DESCRIPTION_MAX, PROJECT_ICON_EXTENSIONS, PROJECT_NAME_MAX } from "@artemis/contracts";
import { isAvatarColorId } from "@/lib/avatar-colors";
import {
  ensureProjectFolder,
  readProjectIcon,
  removeProjectFolder,
  removeProjectIcon,
  saveProjectIcon,
} from "../clients/toolbox-client";
import {
  deleteProject as deleteProjectRow,
  findProject,
  insertProject,
  listProjects,
  setProjectOrder,
  updateProject as updateProjectRow,
  type ProjectRow,
} from "../repositories/project-repository";
import { listProjectConversations } from "../repositories/conversation-repository";
import { conversationJson, type ConversationJson } from "../conversations/conversation-json";

/** The user a project belongs to: its id names the rows, its username names the workspace folder. */
export type ProjectOwner = { id: string; username: string };

/** A rule the caller broke or an outside service that failed. The message is safe to show to the user. */
export class ProjectServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * The project as the apps show it. The icon itself is read from /api/projects/<id>/icon; `updatedAt` lets the apps
 * refresh a cached icon once it changes. Mirrored by the mobile app (apps/mobile/src/queries/projects.ts).
 */
export interface ProjectJson {
  id: string;
  name: string;
  color: string;
  description: string | null;
  hasIcon: boolean;
  updatedAt: string;
}

export function projectJson(row: ProjectRow): ProjectJson {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description,
    hasIcon: row.iconFile !== null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The fields a project form can set. A field left out of a partial update keeps its value. */
interface ProjectFields {
  name?: string;
  color?: string;
  description?: string | null;
}

/** Reads the text fields of a project form. Creation needs a name and a color; an update may leave them out. */
function readFields(form: FormData, partial: boolean): ProjectFields {
  const fields: ProjectFields = {};

  if (form.has("name") || !partial) {
    const name = textOf(form, "name").trim();
    if (name.length === 0) throw new ProjectServiceError("the project needs a name", 400);
    if (name.length > PROJECT_NAME_MAX) {
      throw new ProjectServiceError(`the project name must be ${PROJECT_NAME_MAX} characters or fewer`, 400);
    }
    fields.name = name;
  }

  if (form.has("color") || !partial) {
    const color = textOf(form, "color");
    if (!isAvatarColorId(color)) throw new ProjectServiceError("choose one of the palette colors", 400);
    fields.color = color;
  }

  if (form.has("description")) {
    const description = textOf(form, "description").trim();
    if (description.length > PROJECT_DESCRIPTION_MAX) {
      throw new ProjectServiceError(`the instructions must be ${PROJECT_DESCRIPTION_MAX} characters or fewer`, 400);
    }
    fields.description = description.length > 0 ? description : null;
  }

  return fields;
}

function textOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** The icon the form carries, checked for type and size. Null when the form has none. */
function iconOf(form: FormData): File | null {
  const value = form.get("icon");
  if (!(value instanceof File) || value.size === 0) return null;
  if (!(value.type in PROJECT_ICON_EXTENSIONS)) {
    throw new ProjectServiceError("the icon must be a PNG, JPEG, WebP or GIF image", 422);
  }
  if (value.size > MAX_PROJECT_ICON_BYTES) throw new ProjectServiceError("the icon must be 2 MB or smaller", 422);
  return value;
}

/** Stores an icon in the project folder. The sandbox's own refusals reach the user as they are. */
async function storeIcon(username: string, projectId: string, icon: File): Promise<string> {
  try {
    return await saveProjectIcon(username, projectId, await icon.arrayBuffer(), icon.type);
  } catch (error) {
    throw new ProjectServiceError(error instanceof Error ? error.message : "the icon could not be saved", 422);
  }
}

/**
 * Creates a project: its folder and icon in the workspace first, then its row. If the row cannot be stored the folder
 * is removed again, so a project exists in the database only when its folder does.
 */
export async function createProject(user: ProjectOwner, form: FormData): Promise<ProjectRow> {
  const fields = readFields(form, false);
  const icon = iconOf(form);
  const projectId = crypto.randomUUID();

  try {
    await ensureProjectFolder(user.username, projectId);
  } catch {
    throw new ProjectServiceError("the project folder could not be created right now", 502);
  }

  try {
    const iconFile = icon ? await storeIcon(user.username, projectId, icon) : null;
    return await insertProject({
      id: projectId,
      userId: user.id,
      name: fields.name ?? "",
      color: fields.color ?? "",
      iconFile,
      description: fields.description ?? null,
    });
  } catch (error) {
    await removeProjectFolder(user.username, projectId).catch(() => undefined);
    throw error;
  }
}

/**
 * Changes a project's fields. `icon` replaces the icon, `removeIcon` drops it; without either, the icon stays.
 */
export async function updateProject(user: ProjectOwner, projectId: string, form: FormData): Promise<ProjectRow> {
  const existing = await findProject(projectId, user.id);
  if (!existing) throw new ProjectServiceError("project not found", 404);

  const fields = readFields(form, true);
  const icon = iconOf(form);
  const removeIcon = textOf(form, "removeIcon") === "true";

  let iconFile: string | null | undefined;
  if (icon) {
    iconFile = await storeIcon(user.username, projectId, icon);
  } else if (removeIcon && existing.iconFile !== null) {
    await removeProjectIcon(user.username, projectId).catch(() => {
      throw new ProjectServiceError("the icon could not be removed right now", 502);
    });
    iconFile = null;
  }

  const row = await updateProjectRow(projectId, user.id, {
    ...fields,
    ...(iconFile !== undefined ? { iconFile } : {}),
  });
  if (!row) throw new ProjectServiceError("project not found", 404);
  return row;
}

/**
 * Deletes a project: its folder (files, icon) first, then its row. Its conversations stay in the list, with no project.
 */
export async function deleteProject(user: ProjectOwner, projectId: string): Promise<void> {
  if (!(await findProject(projectId, user.id))) throw new ProjectServiceError("project not found", 404);
  try {
    await removeProjectFolder(user.username, projectId);
  } catch {
    throw new ProjectServiceError("the files of this project could not be removed right now", 502);
  }
  await deleteProjectRow(projectId, user.id);
}

/**
 * Sets the order of the user's projects. `ids` must name every project of the user exactly once: a list that misses
 * one, repeats one, or names another user's project is refused, so the order always covers the whole list.
 */
export async function reorderProjects(user: ProjectOwner, ids: string[]): Promise<void> {
  const current = (await listProjects(user.id)).map((project) => project.id);
  const sameSet = ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
  if (!sameSet) throw new ProjectServiceError("the order must list each of your projects once", 400);
  await setProjectOrder(user.id, ids);
}

/** Deletes every project of the user with its folder. Their conversations stay, outside any project. */
export async function deleteAllProjects(user: ProjectOwner): Promise<void> {
  for (const project of await listProjects(user.id)) {
    await deleteProject(user, project.id);
  }
}

/** The icon of a project the user owns. Null when the project has none. Throws a 404 for a project that is not theirs. */
export async function projectIcon(user: ProjectOwner, projectId: string): Promise<{ bytes: ArrayBuffer; mediaType: string } | null> {
  if (!(await findProject(projectId, user.id))) throw new ProjectServiceError("project not found", 404);
  return readProjectIcon(user.username, projectId);
}

/** The listed conversations of a project, most recent first, one page at a time. */
export async function projectConversations(
  user: ProjectOwner,
  projectId: string,
  limit: number,
  offset: number,
): Promise<{ conversations: ConversationJson[]; total: number }> {
  const project = await findProject(projectId, user.id);
  if (!project) throw new ProjectServiceError("project not found", 404);
  const page = await listProjectConversations(user.id, projectId, limit, offset);
  const summary = { id: project.id, name: project.name, color: project.color };
  return {
    conversations: page.conversations.map((row) => conversationJson({ ...row, project: summary })),
    total: page.total,
  };
}
