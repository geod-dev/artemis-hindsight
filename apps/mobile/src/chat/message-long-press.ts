import { createContext, useContext } from "react";

/**
 * Opens the options of the message around it (message-view.tsx). A sideways row inside the message holds its own touches
 * (visuals/shared.tsx), so it calls this on a long press to keep the message's options reachable from it.
 */
export const MessageLongPressContext = createContext<(() => void) | undefined>(undefined);

export function useMessageLongPress(): (() => void) | undefined {
  return useContext(MessageLongPressContext);
}
