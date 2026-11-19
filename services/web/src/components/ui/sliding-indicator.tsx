"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type Box = { x: number; y: number; width: number; height: number }

/**
 * The raised pill under the selected tab of a TabsList. It follows the item that matches `activeSelector` inside
 * `listRef`, and slides when the selection changes.
 *
 * The list must be `relative`. Until the first measure, `ready` is false, so the items keep their own selected
 * background (server render, no flash); once ready, the items drop it and the indicator draws it.
 */
export function useSlidingIndicator(listRef: React.RefObject<HTMLElement | null>, activeSelector: string) {
  const [box, setBox] = React.useState<Box | null>(null)
  const [animate, setAnimate] = React.useState(false)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const resize = new ResizeObserver(() => measure())
    function measure() {
      const active = list!.querySelector<HTMLElement>(activeSelector)
      for (const child of Array.from(list!.children)) resize.observe(child)
      setBox((current) => {
        if (!active) return null
        const next = { x: active.offsetLeft, y: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight }
        return current && current.x === next.x && current.y === next.y && current.width === next.width && current.height === next.height
          ? current
          : next
      })
    }
    measure()
    resize.observe(list)
    const mutations = new MutationObserver(measure)
    mutations.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] })
    // The first position is set without a transition; later changes slide.
    const frame = requestAnimationFrame(() => setAnimate(true))
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutations.disconnect()
    }
  }, [listRef, activeSelector])

  return { box, animate, ready: box !== null }
}

export function SlidingIndicator({ box, animate, className }: { box: Box | null; animate: boolean; className?: string }) {
  if (!box) return null
  return (
    <span
      aria-hidden
      data-slot="sliding-indicator"
      className={cn(
        "pointer-events-none absolute top-0 left-0 rounded-full bg-background shadow-sm dark:bg-foreground/[0.1]",
        animate &&
          "transition-[translate,width,height] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
        className
      )}
      style={{ translate: `${box.x}px ${box.y}px`, width: box.width, height: box.height }}
    />
  )
}
