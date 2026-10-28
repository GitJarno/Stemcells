// Replaces `features/home/ThreadListFilters.tsx` (`substitutes.cjs`), the header of the home's
// list in the workspace: Aski and the tabs stand over the list (`home/AskiHome.tsx`). On iOS the
// workspace header's top right holds the machine and project (`home/scope.tsx`), not T3's chips.
import { Platform } from "react-native";

import * as Upstream from "../../../features/home/ThreadListFilters";
import { AskiHome } from "../../home/AskiHome";
import { useWorkspaceTabs } from "../home";

export * from "../../../features/home/ThreadListFilters";

export function ThreadListFilters(props: Parameters<typeof Upstream.ThreadListFilters>[0]) {
  const workspace = useWorkspaceTabs();
  const inHeader = Platform.OS === "ios" && workspace !== null;
  return (
    <>
      <AskiHome />
      {inHeader ? null : <Upstream.ThreadListFilters {...props} />}
    </>
  );
}
