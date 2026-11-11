import { getConfig } from "../config";

// Client for Groq's speech to text API (OpenAI-compatible transcription endpoint, Whisper large v3).

const TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const TRANSCRIPTION_MODEL = "whisper-large-v3";

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("GROQ_API_KEY is not set");
  }
}

/** Transcribes one audio file and returns the full transcript. Throws on any Groq error. */
export async function transcribeAudio(audio: Blob, filename: string): Promise<string> {
  const apiKey = getConfig().GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const body = new FormData();
  body.append("file", audio, filename);
  body.append("model", TRANSCRIPTION_MODEL);
  body.append("response_format", "json");

  const res = await fetch(TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`groq transcription failed with HTTP ${res.status}`);

  const json = (await res.json()) as { text?: unknown };
  if (typeof json.text !== "string") throw new Error("groq transcription returned no text");
  return json.text;
}
