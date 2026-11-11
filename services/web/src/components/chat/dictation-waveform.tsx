"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { dictationAdapter } from "./server-dictation-adapter";

// Each bar is 2px wide with a 2px gap. The newest sample is on the right.
const BAR_STEP = 4;
// One sample per bar: the time shown is (bars on screen) × SAMPLE_MS, so a wider space shows more of the recording.
const SAMPLE_MS = 60;
const MAX_SAMPLES = 1000;

/** Microphone loudness between 0 and 1, from the analyser's time-domain samples. */
function levelOf(analyser: AnalyserNode | undefined): number {
  if (!analyser) return 0;
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (const value of data) {
    const sample = (value - 128) / 128;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / data.length);
  return Math.min(1, Math.pow(rms * 4, 0.7));
}

/**
 * The live recording waveform: a pulsing dot, a scrolling row of microphone-level bars and the elapsed time.
 * As many bars as the space allows are drawn, so the waveform fills the space between the buttons.
 * `muted` freezes it in place and fades it, for the time the transcript takes to arrive.
 */
export function DictationWaveform({ seconds, muted = false }: { seconds: number; muted?: boolean }) {
  const barsRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const [samples, setSamples] = useState<number[]>([]);

  // Count the bars that fit the width.
  useEffect(() => {
    const el = barsRef.current;
    if (!el) return;
    const fit = () => setSlots(Math.max(1, Math.floor((el.clientWidth + 2) / BAR_STEP)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sample the microphone level on a fixed rhythm while recording. Muted, the bars stay where they were.
  useEffect(() => {
    if (muted) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < SAMPLE_MS) return;
      last = now;
      const list = samplesRef.current;
      list.push(levelOf(dictationAdapter.analyser()));
      if (list.length > MAX_SAMPLES) list.splice(0, list.length - MAX_SAMPLES);
      setSamples(list.slice());
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [muted]);

  const visible = slots > 0 ? samples.slice(-slots) : [];
  const padded = [...Array.from({ length: Math.max(0, slots - visible.length) }, () => 0), ...visible];
  const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div
      role="status"
      aria-label={muted ? "Transcribing" : "Recording"}
      className={cn("flex min-h-7 min-w-0 flex-1 items-center gap-2", muted && "opacity-60")}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          muted ? "bg-muted-foreground" : "bg-destructive animate-pulse motion-reduce:animate-none",
        )}
      />
      <div ref={barsRef} aria-hidden="true" className="flex h-7 min-w-0 flex-1 items-center justify-end gap-0.5 overflow-hidden">
        {padded.map((level, index) => (
          <span
            key={index}
            className={cn("w-0.5 shrink-0 rounded-full", muted ? "bg-muted-foreground" : "bg-foreground/60")}
            style={{ height: `${Math.round(12 + level * 88)}%` }}
          />
        ))}
      </div>
      <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">{timer}</span>
    </div>
  );
}
