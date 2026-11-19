import OpenAI, { toFile, type Uploadable } from "openai";
import { z } from "zod";
import type { SandboxClient } from "../sandbox-client.js";
import type { Tool } from "../registry.js";

const MODEL = "gpt-image-2";

// The sizes OpenAI lists for gpt-image-2 (any of them meets its size rules), and `auto`, which lets the model choose.
const SIZES = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "1152x2048",
  "3840x2160",
  "2160x3840",
] as const;

const QUALITIES = ["auto", "low", "medium", "high"] as const;

// The image types gpt-image-2 accepts as input, and its limit on input images.
const SOURCE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SOURCES = 16;

const input = z.object({
  filename: z
    .string()
    .max(100)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
      "use letters, digits, dots, dashes and underscores only, starting with a letter or digit",
    )
    .describe(
      "Name of the image file in your images folder, short and descriptive, e.g. red-fox-in-snow.png. For a change to an " +
        "earlier image, name the new version after the change, e.g. red-fox-at-night.png. .png is added when missing; a " +
        "name already taken gets a number, so no image is ever overwritten.",
    ),
  prompt: z
    .string()
    .min(1)
    .max(32_000)
    .describe(
      "What to draw, in detail: subject, composition, style, lighting, text to show. With sources, say what to do with " +
        "each one (keep, change, combine) and what must stay the same.",
    ),
  size: z
    .enum(SIZES)
    .default("auto")
    .describe(
      "Width x height in pixels. 1024 sizes are the fastest; 2048 and 3840 (4K) are for large prints and wallpapers. " +
        "auto picks a size from the prompt.",
    ),
  quality: z
    .enum(QUALITIES)
    .default("auto")
    .describe("low for quick drafts, medium for most images, high for final images with fine detail or small text."),
  sources: z
    .array(z.string().min(1).max(4096))
    .max(MAX_SOURCES)
    .default([])
    .describe(
      "Paths of PNG, JPEG or WebP images to start from: an attachment, or an image generated earlier in this conversation " +
        "to change it. Relative paths start in your default folder. Leave empty to draw from the prompt alone.",
    ),
});

/**
 * Draws an image with OpenAI's gpt-image-2, from the prompt alone or from source images in the sandbox, and saves it
 * as a PNG in the conversation's images folder, under the name the model chose. The model gets the path and a ready-made file link, so it can show the
 * image in its reply and pass the path back as a source to change it on a later turn.
 */
export function createGenerateImageTool(sandbox: SandboxClient, openai: OpenAI): Tool<typeof input> {
  return {
    name: "generate_image",
    description:
      "Generate an image with GPT Image 2 and save it as a PNG, under the file name you give, in the images folder of " +
      "your session. " +
      "Give source images to edit or combine them: a photo the user attached, or an image you generated before. " +
      "To change an image you made, call this again with its path in sources and describe the change. " +
      "Show the result to the user with the link this tool returns. Generating takes up to a minute or two.",
    input,
    async run({ filename, prompt, size, quality, sources }, ctx) {
      const request = { model: MODEL, prompt, size, quality, output_format: "png" as const };
      const images = await Promise.all(sources.map((path) => loadSource(sandbox, ctx.sessionId, path)));
      const response =
        images.length === 0
          ? await openai.images.generate(request)
          : await openai.images.edit({ ...request, image: images });

      const base64 = response.data?.[0]?.b64_json;
      if (!base64) throw new Error("the image API returned no image");
      const saved = await sandbox.saveImage(ctx.sessionId, pngName(filename), Buffer.from(base64, "base64"), "image/png");
      return {
        path: saved.path,
        absolutePath: saved.absolutePath,
        link: `[${saved.name}](<#sandbox-file:${saved.path}>)`,
      };
    },
  };
}

/** The file name with a .png extension: the image is always a PNG. */
function pngName(filename: string): string {
  return filename.toLowerCase().endsWith(".png") ? filename : `${filename}.png`;
}

/** Reads a source image from the sandbox, as a file the OpenAI client can upload. */
async function loadSource(sandbox: SandboxClient, sessionId: string, path: string): Promise<Uploadable> {
  const file = await sandbox.serveFile(sessionId, path);
  if (!file) throw new Error(`source not found: ${path}`);
  if (!SOURCE_MEDIA_TYPES.has(file.mediaType)) {
    throw new Error(`source ${path} is not a PNG, JPEG or WebP image; convert it first`);
  }
  const name = path.split("/").pop() ?? "source";
  return toFile(Buffer.from(file.bytes), name, { type: file.mediaType });
}

