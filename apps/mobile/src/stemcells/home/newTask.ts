// T3's new chat starts in the project its list is filtered to (`AdaptiveWorkspaceLayout.tsx`, a
// seam). On iOS the home's header picks stand in that filter (`scope.tsx`), so a new Cell starts
// in the one project they pick, on the one machine; T3's own pick, which the home ignores there,
// never decides.

import { Platform } from "react-native";

import {
  buildHomeProjectScopes,
  EnvironmentId,
  type EnvironmentProject,
  type SidebarProjectGroupingMode,
  type ThreadListFilters,
} from "../upstream/threads";
import { oneOfEach } from "./picks";
import { readPicks } from "./usePicks";

export function newTaskListFilters(
  upstream: ThreadListFilters | undefined,
  projects: ReadonlyArray<EnvironmentProject>,
  projectGroupingMode: SidebarProjectGroupingMode,
): ThreadListFilters | undefined {
  if (Platform.OS !== "ios") return upstream;
  const one = oneOfEach(
    readPicks(),
    buildHomeProjectScopes({ projects, environmentId: null, projectGroupingMode }),
  );
  return {
    environmentId: one.machine === null ? null : EnvironmentId.make(one.machine),
    projectKey: one.projectKey,
  };
}
