import type { DictationAdapter } from "@assistant-ui/react";

/**
 * Dictation that records with MediaRecorder and sends the recording to our transcription route on stop.
 * The transcript comes back whole, so it arrives as one final result. Follows the assistant-ui dictation guide.
 */
export class ServerDictationAdapter implements DictationAdapter {
  constructor(private endpoint = "/api/transcribe") {}

  listen(): DictationAdapter.Session {
    const speechStart = new Set<() => void>();
    const speechEnd = new Set<(r: DictationAdapter.Result) => void>();
    const speech = new Set<(r: DictationAdapter.Result) => void>();

    let mediaRecorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const chunks: BlobPart[] = [];

    const session: DictationAdapter.Session = {
      status: { type: "starting" },

      stop: async () => {
        mediaRecorder?.stop();
      },

      cancel: () => {
        cancelled = true;
        mediaRecorder?.stop();
        stream?.getTracks().forEach((t) => t.stop());
        session.status = { type: "ended", reason: "cancelled" };
      },

      onSpeechStart: (cb) => {
        speechStart.add(cb);
        return () => speechStart.delete(cb);
      },
      onSpeechEnd: (cb) => {
        speechEnd.add(cb);
        return () => speechEnd.delete(cb);
      },
      onSpeech: (cb) => {
        speech.add(cb);
        return () => speech.delete(cb);
      },
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        mediaRecorder.onstop = async () => {
          stream?.getTracks().forEach((t) => t.stop());
          if (cancelled) return;
          try {
            const type = mediaRecorder?.mimeType || "audio/webm";
            const body = new FormData();
            body.append("audio", new Blob(chunks, { type }), `dictation.${extensionFor(type)}`);

            const res = await fetch(this.endpoint, { method: "POST", body });
            if (!res.ok) throw new Error("transcription failed");

            const { text } = (await res.json()) as { text: string };
            const result: DictationAdapter.Result = { transcript: text, isFinal: true };
            for (const cb of speech) cb(result);
            for (const cb of speechEnd) cb(result);
            session.status = { type: "ended", reason: "stopped" };
          } catch {
            session.status = { type: "ended", reason: "error" };
          }
        };

        mediaRecorder.start();
        session.status = { type: "running" };
        for (const cb of speechStart) cb();
      } catch {
        session.status = { type: "ended", reason: "error" };
      }
    })();

    return session;
  }
}

/** The file extension tells the transcription service the container format. */
function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}
