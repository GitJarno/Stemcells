// Replaces `hooks/usePreviewPanelInlineSize.ts` (`plugin.ts`): a chat in a
// pane caps its panel's width against the tab's page. Upstream caps it
// against the chat's own layout, which holds the panel beside the chat; on
// the slate the panel sits beside the pane, so a wider panel narrowed the
// pane, which lowered the cap, which narrowed the panel... A stored width
// past the middle shook the layout between two widths from launch, without
// end, and a width drag shook it for as long as it was held. The page
// doesn't change width with the panel. Outside a pane it is upstream's.
// The edge's drag passes over the desktop browser (`dragThrough.ts`).
import { usePreviewPanelInlineSize as useUpstreamInlineSize } from "../../../hooks/usePreviewPanelInlineSize";
import { letDragsThrough } from "../../workbench/dragThrough";

export * from "../../../hooks/usePreviewPanelInlineSize";

letDragsThrough();

export function usePreviewPanelInlineSize(
  ...[hostRef, options = {}]: Parameters<typeof useUpstreamInlineSize>
): ReturnType<typeof useUpstreamInlineSize> {
  const container = options.container?.closest<HTMLElement>("[data-stemcells-page]");
  return useUpstreamInlineSize(hostRef, container ? { ...options, container } : options);
}
