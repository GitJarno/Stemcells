// Replaces `hooks/usePreviewPanelInlineSize.ts` (`plugin.ts`): in a pane, the panel's width cap
// is measured against the tab's page, not the chat's layout: on the slate the panel sits beside
// the pane, so a wider panel narrowed the pane and its cap, and the layout shook without end.
// Outside a pane it is upstream's. Its edge drags through the desktop browser (`dragThrough.ts`).
import { usePreviewPanelInlineSize as useUpstreamInlineSize } from "../../../hooks/usePreviewPanelInlineSize";
import { letDragsThrough } from "../../workbench/dragThrough";

export * from "../../../hooks/usePreviewPanelInlineSize";

letDragsThrough();

export function usePreviewPanelInlineSize(
  ...[options = {}]: Parameters<typeof useUpstreamInlineSize>
): ReturnType<typeof useUpstreamInlineSize> {
  const container = options.container?.closest<HTMLElement>("[data-stemcells-page]");
  return useUpstreamInlineSize(container ? { ...options, container } : options);
}
