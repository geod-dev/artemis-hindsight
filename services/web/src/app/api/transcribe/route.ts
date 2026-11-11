import { GroqNotConfiguredError, transcribeAudio } from "@/server/clients/groq-client";

export const runtime = "nodejs";

// Groq accepts files up to 25 MB on the standard tier.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Speech to text for the composer's dictation: takes the recorded audio, returns the transcript. */
export async function POST(req: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "multipart form data required" }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "audio required" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio is too large" }, { status: 413 });
  }

  try {
    // The extension tells Groq the container format, so keep the name the browser's recorder gave the upload.
    const filename = audio instanceof File && audio.name ? audio.name : "dictation.webm";
    const text = await transcribeAudio(audio, filename);
    return Response.json({ text });
  } catch (error) {
    if (error instanceof GroqNotConfiguredError) {
      return Response.json({ error: "dictation is not configured" }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "transcription failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
