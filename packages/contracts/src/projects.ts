import { z } from "zod";

// Projects: a folder of the user's workspace (<workspace>/<username>/projects/<project-id>) with a name, a color, an
// optional icon and optional instructions for the agent. The sandbox stores the folder and its icon; the web app
// keeps the rows.

/** The icon formats a project accepts, with the extension the sandbox stores them under. SVG is left out on purpose. */
export const PROJECT_ICON_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_PROJECT_ICON_BYTES = 2 * 1024 * 1024;

export const projectIdSchema = z.uuid();

export const PROJECT_NAME_MAX = 60;
export const PROJECT_DESCRIPTION_MAX = 4000;
