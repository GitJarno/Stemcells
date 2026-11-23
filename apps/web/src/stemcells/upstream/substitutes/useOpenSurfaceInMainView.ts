// Replaces `hooks/useOpenSurfaceInMainView.ts` (`plugin.ts`): a Subcell's or side chat's panel tab
// moves to a pane beside its Cell, which stays, where upstream's takes its place on screen.
import { useOpenSurfaceInMainView as useUpstreamOpenSurfaceInMainView } from "../../../hooks/useOpenSurfaceInMainView";
import { useRightPanelStore } from "../../../rightPanelStore";
import { openCellBeside } from "../../tabs/commands";

export function useOpenSurfaceInMainView(
  ...[panelRef]: Parameters<typeof useUpstreamOpenSurfaceInMainView>
): ReturnType<typeof useUpstreamOpenSurfaceInMainView> {
  const open = useUpstreamOpenSurfaceInMainView(panelRef);
  return (surface) => {
    if (
      panelRef !== null &&
      surface.kind === "thread" &&
      openCellBeside({
        environmentId: panelRef.environmentId,
        threadId: surface.threadId,
        draftId: null,
      })
    ) {
      useRightPanelStore.getState().closeSurface(panelRef, surface.id);
      return;
    }
    open(surface);
  };
}
