"use client";

import { mountAvatar, type MountedAvatar } from "open-bot-avatar/dom";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { loadMascotDefinition } from "./mascot-definition";
import { useThinkingMotion } from "./mascot-motion";

/**
 * The bot's colors, the same wherever the mascot appears: the body is the theme's primary color (Google blue in
 * light mode, the foreground color in dark mode), and the eyes take the page background, so they read as cut-outs.
 */
const BODY_COLOR = "var(--primary)";
const EYE_COLOR = "var(--background)";

export interface MascotProps {
  /** True while the assistant is generating: the container spins and bounces. The shape itself stays idle. */
  thinking?: boolean;
  /** Width and height in CSS pixels. */
  size: number;
  /** Accessible name. Empty (the default) marks the mascot decorative. */
  label?: string;
  className?: string;
}

/**
 * The chat mascot. Our wrapper around open-bot-avatar's imperative mountAvatar: it fetches the shape once and
 * mounts it into a square element that stays idle. The thinking motion is applied to that square by useThinkingMotion,
 * so the library never changes mood. The square stays empty until the shape has loaded.
 */
export function Mascot({ thinking = false, size, label = "", className }: MascotProps) {
  const host = useRef<HTMLDivElement>(null);
  const mascot = useRef<MountedAvatar | null>(null);
  const latestLabel = useRef(label);

  useThinkingMotion(host, thinking);

  useEffect(() => {
    let cancelled = false;
    loadMascotDefinition()
      .then((definition) => {
        if (cancelled || !host.current) return;
        mascot.current = mountAvatar(host.current, {
          definition,
          color: BODY_COLOR,
          eyeColor: EYE_COLOR,
          followPointer: true,
          label: latestLabel.current,
        });
      })
      .catch((error: unknown) => {
        console.error("Could not load the mascot", error);
      });
    return () => {
      cancelled = true;
      mascot.current?.destroy();
      mascot.current = null;
    };
  }, []);

  useEffect(() => {
    latestLabel.current = label;
    mascot.current?.update({ label });
  }, [label]);

  return (
    <div
      ref={host}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
