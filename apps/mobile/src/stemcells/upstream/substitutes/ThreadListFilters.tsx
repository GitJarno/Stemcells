// Replaces `features/home/ThreadListFilters.tsx` (`substitutes.cjs`), the
// header of the home's list in the workspace: Aski and the tabs stand over
// T3's filters while the home shows its tabs (`home/AskiHome.tsx`).
import * as Upstream from "../../../features/home/ThreadListFilters";
import { AskiHome } from "../../home/AskiHome";

export * from "../../../features/home/ThreadListFilters";

export function ThreadListFilters(props: Parameters<typeof Upstream.ThreadListFilters>[0]) {
  return (
    <>
      <AskiHome />
      <Upstream.ThreadListFilters {...props} />
    </>
  );
}
