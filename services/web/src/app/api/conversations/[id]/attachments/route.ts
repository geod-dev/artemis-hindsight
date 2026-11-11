import { z } from "zod";
import { sandboxFileUrl } from "@/lib/sandbox-files";
import { uploadAttachment } from "@/server/clients/toolbox-client";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { canUseConversation } from "@/server/repositories/conversation-repository";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Stores an uploaded file in the conversation's sandbox. Responds with the file's path and its url.
 * A conversation that does not exist yet is fine (the first upload comes before the first message).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid conversation" }, { status: 400 });
  if (!(await canUseConversation(id, user.id))) return Response.json({ error: "conversation not found" }, { status: 404 });

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
