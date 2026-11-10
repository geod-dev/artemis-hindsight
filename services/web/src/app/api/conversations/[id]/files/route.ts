import { z } from "zod";
import { readSessionFile } from "@/server/clients/toolbox-client";

export const runtime = "nodejs";

/**
 * Serves a file from a conversation's sandbox folder: attachments, and files the agent wrote.
 * The path is relative to the session folder, e.g. ?path=attachments/report.pdf.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid conversation" }, { status: 400 });

  const path = new URL(req.url).searchParams.get("path");
  if (!path) return Response.json({ error: "path is required" }, { status: 400 });

  try {
    const file = await readSessionFile(id, path);
    if (!file) return Response.json({ error: "no such file" }, { status: 404 });
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": file.mediaType,
        "content-disposition": file.contentDisposition,
        "content-length": String(file.bytes.byteLength),
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "could not read the file";
    return Response.json({ error: message }, { status: 422 });
  }
}
