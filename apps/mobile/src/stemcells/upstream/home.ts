// What the phone's home takes from upstream's: its segmented control (the tabs), how it opens a
// chat, which column it stands in, whether it stands in the workspace (where its list has a
// header), the header's items, the machines and projects its list is narrowed to, how many older
// settled chats the servers keep, and where the phone keeps its picks.

import { useAtomValue } from "@effect/atom-react";
import { Directory, File, Paths } from "expo-file-system";

import { useSelectWorkspaceDetail } from "../../features/workspace/useSelectWorkspaceDetail";
import { writeFileAtomically } from "../../lib/atomic-file";
import { threadListEnvironmentsAtom } from "../../state/server";

export type { EnvironmentMachineKind } from "@t3tools/contracts";

export { SegmentedControl } from "../../components/ui/SegmentedControl";
export {
  useWorkspaceTabs,
  WorkspaceTabsContext,
} from "../../features/workspace/WorkspaceTabsContext";
export { useOlderSettledShelf } from "../../state/olderSettledShelf";
export type { OlderSettledScope } from "@t3tools/client-runtime/state/threads";
export { NativePrimaryColumnContext } from "../../native/v5-workspace-context";
export { Toolbar } from "../../components/ui/Toolbar";
export { Menu } from "../../components/ui/Menu";
export { SymbolView } from "../../components/ui/AppSymbol";
export { ProjectFavicon } from "../../components/ProjectFavicon";
export { ENVIRONMENT_MACHINE_SYMBOLS } from "../../components/EnvironmentMachineSymbol";
export { useProjects } from "../../state/entities";
export { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
export { useHomeListOptions } from "../../features/home/home-list-options";

/** A transparent header with nothing behind it: iOS 27's `automatic` edge is a hard band. */
export const NO_HEADER_BAND = {
  top: "hidden",
  bottom: "hidden",
  left: "hidden",
  right: "hidden",
} as const;

/** Each environment's kind of machine, where it says. */
export function useMachineKinds() {
  return useAtomValue(threadListEnvironmentsAtom).machineByEnvironmentId;
}

/** Opens a chat as upstream's home opens a thread (`HomeRouteScreen.tsx`). */
export function useHomeThreadSelection() {
  const selectDetail = useSelectWorkspaceDetail();
  return (thread: { readonly environmentId: string; readonly id: string }) =>
    selectDetail({
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    });
}

const keptFile = (name: string) => new File(new Directory(Paths.document, "stemcells"), name);

/** A small file of ours on the phone, read whole; null when there's none yet. */
export function readKept(name: string): string | null {
  try {
    const file = keptFile(name);
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}

/** Writes a small file of ours whole, so a crash mid-write leaves the last one. */
export function writeKept(name: string, text: string): Promise<void> {
  return writeFileAtomically(keptFile(name), text).catch(() => undefined);
}
