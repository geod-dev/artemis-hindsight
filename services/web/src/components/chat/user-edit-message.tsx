"use client";

import { useAui, useAuiState } from "@assistant-ui/react";
import { useEffect, useRef, type FC } from "react";
import { EditMessage } from "@/components/assistant-ui/elements/edit-message";

/**
 * Edit state of a user message, drawn with the edit-message element. Rendered inside the message row while
 * the message is being edited, so aui.composer is that message's edit composer.
 * The element is used as downloaded; the size, position and focus come from the wrapper and className.
 */
export const UserEditMessage: FC = () => {
  const aui = useAui();
  const value = useAuiState((s) => s.composer.text);
  const wrapper = useRef<HTMLDivElement>(null);

  // The element's textarea has no autofocus, so focus it here, with the caret after the text.
  useEffect(() => {
    const textarea = wrapper.current?.querySelector("textarea");
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  return (
    <div ref={wrapper} className="flex w-full justify-end">
      <EditMessage
        className="w-[85%] max-w-none [&_textarea]:text-base"
        value={value}
        discardedReplies={0}
        editing
        onValueChange={(next) => aui.composer.setText(next)}
        onSave={() => aui.composer.send()}
        onCancel={() => aui.composer.cancel()}
      />
    </div>
  );
};
