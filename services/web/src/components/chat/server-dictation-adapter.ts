import type { DictationAdapter } from "@assistant-ui/react";

/** How one dictation ended: with a transcript, with a failure, or cancelled by the user. */
export type TranscriptOutcome = { type: "text"; text: string } | { type: "error" } | { type: "cancelled" };
export type TranscriptHandler = (outcome: TranscriptOutcome) => void;

/**
 * Dictation that records with MediaRecorder and sends the recording to our transcription route on stop.
 * A composer claims the next session with expectTranscript(), and its transcript then goes to that composer
 * (which inserts it at the caret). Without a claim, the transcript goes to the runtime as one final result.
 * Follows the assistant-ui dictation guide.
 */
export class ServerDictationAdapter implements DictationAdapter {
  private claimed: TranscriptHandler | undefined;
  private active: DictationAdapter.Session | undefined;
  private meter: { context: AudioContext; analyser: AnalyserNode } | undefined;

  constructor(private endpoint = "/api/transcribe") {}

  /** The next session started through the runtime delivers its outcome to this handler. */
  expectTranscript(handler: TranscriptHandler): void {
    this.claimed = handler;
  }

  /** Cancels the session in progress, if any. Its transcript is discarded. */
  cancelActive(): void {
    this.active?.cancel();
  }

  /** The microphone's analyser while a session records, for the live waveform. Undefined otherwise. */
  analyser(): AnalyserNode | undefined {
    return this.meter?.analyser;
  }

  listen(): DictationAdapter.Session {
    const handler = this.claimed;
    this.claimed = undefined;

    const speechStart = new Set<() => void>();
    const speechEnd = new Set<(r: DictationAdapter.Result) => void>();
    const speech = new Set<(r: DictationAdapter.Result) => void>();

    let mediaRecorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let settled = false;
    const chunks: BlobPart[] = [];
    let meter: { context: AudioContext; analyser: AnalyserNode } | undefined;
    // Ends the level meter. Only the session that owns it clears the adapter's pointer.
    const closeMeter = () => {
      if (!meter) return;
      if (this.meter === meter) this.meter = undefined;
      void meter.context.close();
      meter = undefined;
    };

    // The claiming composer hears the outcome once: a transcript, a failure or a cancel, whichever comes first.
    const settle = (outcome: TranscriptOutcome) => {
      if (!handler || settled) return;
      settled = true;
      handler(outcome);
    };

    const session: DictationAdapter.Session = {
      status: { type: "starting" },

      stop: async () => {
        // Stopped before the microphone was ready: nothing was recorded, so this is a cancel.
        if (!mediaRecorder) {
          session.cancel();
          return;
        }
        mediaRecorder.stop();
      },

      cancel: () => {
        cancelled = true;
        mediaRecorder?.stop();
        stream?.getTracks().forEach((t) => t.stop());
        closeMeter();
        session.status = { type: "ended", reason: "cancelled" };
        settle({ type: "cancelled" });
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
    this.active = session;

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        meter = openMeter(stream);
        this.meter = meter;
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        mediaRecorder.onstop = async () => {
          stream?.getTracks().forEach((t) => t.stop());
          closeMeter();
          if (cancelled) return;
          // The recording is over: the runtime's session ends now. A claimed transcript arrives on the handler.
          if (handler) session.status = { type: "ended", reason: "stopped" };
          try {
            const type = mediaRecorder?.mimeType || "audio/webm";
            const body = new FormData();
            body.append("audio", new Blob(chunks, { type }), `dictation.${extensionFor(type)}`);

            const res = await fetch(this.endpoint, { method: "POST", body });
            if (!res.ok) throw new Error("transcription failed");

            const { text } = (await res.json()) as { text: string };
            if (cancelled) return;
            if (handler) {
              settle({ type: "text", text });
              return;
            }
            const result: DictationAdapter.Result = { transcript: text, isFinal: true };
            for (const cb of speech) cb(result);
            for (const cb of speechEnd) cb(result);
            session.status = { type: "ended", reason: "stopped" };
          } catch {
            if (handler) {
              settle({ type: "error" });
              return;
            }
            session.status = { type: "ended", reason: "error" };
          }
        };

        mediaRecorder.start();
        session.status = { type: "running" };
        for (const cb of speechStart) cb();
      } catch {
        closeMeter();
        settle({ type: "error" });
        session.status = { type: "ended", reason: "error" };
      }
    })();

    return session;
  }
}

/** The shared adapter: the runtime uses it, and the composer claims its sessions. */
export const dictationAdapter = new ServerDictationAdapter("/api/transcribe");

/** Taps the microphone for the waveform. Undefined when the browser can't, so recording still works without it. */
function openMeter(stream: MediaStream): { context: AudioContext; analyser: AnalyserNode } | undefined {
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    void context.resume();
    return { context, analyser };
  } catch {
    return undefined;
  }
}

/** The file extension tells the transcription service the container format. */
function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}
