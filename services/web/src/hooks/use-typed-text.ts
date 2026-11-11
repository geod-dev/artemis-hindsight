"use client";

import { useEffect, useRef, useState } from "react";

const TYPE_MS = 28;
const ERASE_MS = 12;

interface Frame {
  text: string;
  ms: number;
}

/**
 * Shows `target`. The first value appears at once. When `target` changes later, the text on screen is erased back
 * to the part both share, then the new text is typed out one character at a time. Reduced-motion users get no animation.
 */
export function useTypedText(target: string): { text: string; typing: boolean } {
  const [text, setText] = useState(target);
  const [typing, setTyping] = useState(false);
  // What is on screen now. A restarted animation continues from here.
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = target;
      setText(target);
      return;
    }

    let shared = 0;
    while (shared < from.length && shared < target.length && from[shared] === target[shared]) shared++;

    const frames: Frame[] = [];
    for (let i = from.length - 1; i >= shared; i--) frames.push({ text: from.slice(0, i), ms: ERASE_MS });
    for (let i = shared + 1; i <= target.length; i++) frames.push({ text: target.slice(0, i), ms: TYPE_MS });

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let next = 0;
    const step = () => {
      if (cancelled) return;
      const frame = frames[next++];
      if (!frame) {
        setTyping(false);
        return;
      }
      shownRef.current = frame.text;
      setText(frame.text);
      timer = setTimeout(step, frame.ms);
    };

    setTyping(true);
    step();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setTyping(false);
    };
  }, [target]);

  return { text, typing };
}
