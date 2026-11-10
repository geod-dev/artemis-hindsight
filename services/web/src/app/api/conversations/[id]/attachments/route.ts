import { z } from "zod";
import { sandboxFileUrl } from "@/lib/sandbox-files";
import { uploadAttachment } from "@/server/clients/toolbox-client";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

/** Stores an uploaded file in the conversation's sandbox. Responds with the file's path and its url. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid conversation" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "a file is required" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "file is larger than 5 MB" }, { status: 413 });

  try {
    const saved = await uploadAttachment(id, file.name, await file.arrayBuffer(), file.type || "application/octet-stream");
    return Response.json({
      name: saved.name,
      path: saved.path,
      mediaType: saved.mediaType,
      size: saved.size,
      url: sandboxFileUrl(id, saved.path),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload failed";
    console.error("attachment upload failed", { conversationId: id, message });
    return Response.json({ error: message }, { status: 422 });
  }
}
