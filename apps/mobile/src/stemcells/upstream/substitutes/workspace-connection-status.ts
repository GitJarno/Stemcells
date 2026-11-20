// Replaces `features/home/workspace-connection-status.ts` (`substitutes.cjs`): the header's
// status while the phone loads or syncs says Cells, where T3's says threads.
import * as Upstream from "../../../features/home/workspace-connection-status";

export * from "../../../features/home/workspace-connection-status";

export function workspaceConnectionStatusPresentation(
  ...args: Parameters<typeof Upstream.workspaceConnectionStatusPresentation>
): ReturnType<typeof Upstream.workspaceConnectionStatusPresentation> {
  const shown = Upstream.workspaceConnectionStatusPresentation(...args);
  return shown && { ...shown, label: shown.label.replace(/ threads\.\.\.$/, " Cells…") };
}
