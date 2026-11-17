import type { Href } from "expo-router";

/**
 * The page the settings were opened from. The drawer's history is not a stack, so "back" from the settings needs to know
 * it: the drawer records it when it opens the settings (conversations-drawer.tsx), and the settings' back buttons go there.
 */
let returnTo: Href = "/new";

export function setReturnTo(href: Href): void {
  returnTo = href;
}

export function getReturnTo(): Href {
  return returnTo;
}
