// Replaces `features/home/ThreadListFilters.tsx` (`substitutes.cjs`), the header of the home's
// list in the workspace: a stage's top, the same room on each (`home/StagePill.tsx`). On iOS the
// workspace header's top right holds the machine and project (`home/scope.tsx`), not T3's chips.
// Awake's top holds the rows Aski's plan is about to start (`home/PlannedRows.tsx`).
import { Platform } from "react-native";

import * as Upstream from "../../../features/home/ThreadListFilters";
import { PlannedRows } from "../../home/PlannedRows";
import { StageTop } from "../../home/StagePill";
import { useWorkspaceTabs } from "../home";

export * from "../../../features/home/ThreadListFilters";

export function ThreadListFilters(props: Parameters<typeof Upstream.ThreadListFilters>[0]) {
  const workspace = useWorkspaceTabs();
  const inHeader = Platform.OS === "ios" && workspace !== null;
  return (
    <>
      <StageTop />
      <PlannedRows gutter={props.gutter} />
      {inHeader ? null : <Upstream.ThreadListFilters {...props} />}
    </>
  );
}
