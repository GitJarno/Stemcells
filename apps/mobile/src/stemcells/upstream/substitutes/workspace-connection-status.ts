// Replaces `features/home/workspace-connection-status.ts` (`substitutes.cjs`): the header's
// status while the phone loads or syncs says Cells, where T3's says threads.
import * as Upstream from "../../../features/home/workspace-connection-status";

export * from "../../../features/home/workspace-connection-status";

export function workspaceConnectionStatusPresentation(
  state: Parameters<typeof Upstream.workspaceConnectionStatusPresentation>[0],
): ReturnType<typeof Upstream.workspaceConnectionStatusPresentation> {
  const shown = Upstream.workspaceConnectionStatusPresentation(state);
  return shown && { ...shown, label: shown.label.replace(/ threads\.\.\.$/, " Cells…") };
}
