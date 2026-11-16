import { ChartBlock, ComparisonCardBlock, SpecSheetBlock } from "./data-visuals";
import { IMAGE_GROUP_LANGUAGE, imageGroupBlock } from "./image-group";
import { mermaidBlock } from "./mermaid-diagram";
import { visualLanguage } from "./visual-block";

/**
 * Every visual the agent can put in a reply, by code block language. Pass as `componentsByLanguage` to MarkdownText.
 * Visual languages start with `visual__`, so they never clash with a real code language. A plain ```mermaid block is a
 * diagram too: models write Mermaid that way unprompted.
 */
export const visualComponentsByLanguage = {
  [IMAGE_GROUP_LANGUAGE]: visualLanguage(imageGroupBlock),
  visual__comparison_card: visualLanguage(ComparisonCardBlock),
  visual__spec_sheet: visualLanguage(SpecSheetBlock),
  visual__chart: visualLanguage(ChartBlock),
  visual__diagram: visualLanguage(mermaidBlock("visual__diagram")),
  mermaid: visualLanguage(mermaidBlock("mermaid")),
};
