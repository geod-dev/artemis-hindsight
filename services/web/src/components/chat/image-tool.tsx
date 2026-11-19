import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";
import { ImageGeneration } from "@/components/assistant-ui/elements/image-generation";

/** The toolbox's image generation tool (GPT Image 2). Same name in apps/mobile/src/chat/parts/tool-part.tsx. */
export const IMAGE_TOOL = "generate_image";

/** Its activity row: "Generating image" while it runs, "Generated image" with a picture icon once done. */
export function imageToolView(finished: boolean): { label: string; icon: ReactNode } {
  return {
    label: finished ? "Generated image" : "Generating image",
    icon: <ImageIcon aria-label="Image" className="text-muted-foreground size-3.5" />,
  };
}

/**
 * The frame shown under the run while an image is being generated: the registry's ImageGeneration, always generating.
 * Once the call ends it goes away, and the reply shows the real picture through its file link.
 * The element's corner label is a fixed "1024 × 1024", which the requested size often is not, so it is hidden here.
 */
export function ImageGenerationPlaceholder({ prompt }: { prompt: string }) {
  return <ImageGeneration prompt={prompt} generating className="my-2 [&_span.tabular-nums]:hidden" />;
}
