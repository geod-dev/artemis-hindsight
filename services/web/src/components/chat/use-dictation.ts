"use client";

import { useAui, useAuiState } from "@assistant-ui/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { dictationAdapter, type TranscriptOutcome } from "./server-dictation-adapter";

/** idle: the normal bar. recording: waveform and stop/send. transcribing: stopped, waiting for the text. */
export type DictationPhase = "idle" | "recording" | "transcribing";

/**
 * Dictation for one composer. The transcript is inserted at the last caret position of the input (or at the end
 * when the caret was never placed), and "send" sends the message once the transcript is in.
 */
export function useDictation(inputRef: RefObject<HTMLTextAreaElement | null>) {
  const aui = useAui();
  const dictation = useAuiState((s) => s.composer.dictation);
  const [transcribing, setTranscribing] = useState(false);
  const sendAfter = useRef(false);
  // Last caret position of the input. It stays valid after the input loses focus to the bar's buttons.
  const caret = useRef<number | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const remember = () => {
      if (document.activeElement === input) caret.current = input.selectionStart;
    };
    const events = ["select", "keyup", "mouseup", "input", "focus"] as const;
    for (const event of events) input.addEventListener(event, remember);
    return () => {
      for (const event of events) input.removeEventListener(event, remember);
    };
  }, [inputRef]);

  const insertAtCaret = (transcript: string): boolean => {
    const text = transcript.trim();
    if (!text) return false;
    const current = aui.composer.getState().text;
    const position = Math.min(Math.max(caret.current ?? current.length, 0), current.length);
    const before = current.slice(0, position);
    const after = current.slice(position);
    const lead = before && !/\s$/.test(before) ? " " : "";
    const trail = after && !/^\s/.test(after) ? " " : "";
    const head = before + lead + text;
    aui.composer.setText(head + trail + after);
    caret.current = head.length;
    const input = inputRef.current;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(head.length, head.length);
    });
    return true;
  };

  const onOutcome = (outcome: TranscriptOutcome) => {
    setTranscribing(false);
    const send = sendAfter.current;
    sendAfter.current = false;
    if (outcome.type !== "text") return;
    const inserted = insertAtCaret(outcome.text);
    if (send && inserted) aui.composer.send();
  };

  const start = () => {
    dictationAdapter.expectTranscript(onOutcome);
    aui.composer.startDictation();
  };

  /** Stops recording and transcribes. With andSend, the message is sent after the transcript is inserted. */
  const stop = (andSend: boolean) => {
    if (!aui.composer.getState().dictation || transcribing) return;
    sendAfter.current = andSend;
    setTranscribing(true);
    aui.composer.stopDictation();
  };

  const cancel = () => {
    sendAfter.current = false;
    dictationAdapter.cancelActive();
    setTranscribing(false);
  };

  const phase: DictationPhase = transcribing ? "transcribing" : dictation ? "recording" : "idle";

  // Elapsed seconds of the current recording, for the timer in the composer voice element.
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (phase !== "recording") return;
    const started = Date.now();
    setSeconds(0);
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  return { phase, seconds, start, stop, cancel };
}
