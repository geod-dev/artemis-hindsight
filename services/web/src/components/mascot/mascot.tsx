"use client";

import { mountAvatar, type MountedAvatar } from "open-bot-avatar/dom";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { loadAvatarDefinition } from "./avatar-definition";
import { useThinkingMotion } from "./thinking-motion";

/**
 * The bot's colors, the same wherever the avatar appears: the body is the theme's primary color (Google blue in
 * light mode, the foreground color in dark mode), and the eyes take the page background, so they read as cut-outs.
 */
const BODY_COLOR = "var(--primary)";
const EYE_COLOR = "var(--background)";

export interface BotAvatarProps {
  /** True while the assistant is generating: the container spins and bounces. The shape itself stays idle. */
  thinking?: boolean;
  /** Width and height in CSS pixels. */
  size: number;
  /** Accessible name. Empty (the default) marks the avatar decorative. */
  label?: string;
  className?: string;
}

/**
 * The chat bot's avatar. Our wrapper around open-bot-avatar's imperative mountAvatar: it fetches the shape once and
 * mounts it into a square element that stays idle. The thinking motion is applied to that square by useThinkingMotion,
 * so the library never changes mood. The square stays empty until the shape has loaded.
 */
export function BotAvatar({ thinking = false, size, label = "", className }: BotAvatarProps) {
  const host = useRef<HTMLDivElement>(null);
  const avatar = useRef<MountedAvatar | null>(null);
  const latestLabel = useRef(label);

  useThinkingMotion(host, thinking);

  useEffect(() => {
    let cancelled = false;
    loadAvatarDefinition()
      .then((definition) => {
        if (cancelled || !host.current) return;
        avatar.current = mountAvatar(host.current, {
          definition,
          color: BODY_COLOR,
          eyeColor: EYE_COLOR,
          followPointer: true,
          label: latestLabel.current,
        });
      })
      .catch((error: unknown) => {
        console.error("Could not load the chat avatar", error);
      });
    return () => {
      cancelled = true;
      avatar.current?.destroy();
      avatar.current = null;
    };
  }, []);

  useEffect(() => {
    latestLabel.current = label;
    avatar.current?.update({ label });
  }, [label]);

  return (
    <div
      ref={host}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
