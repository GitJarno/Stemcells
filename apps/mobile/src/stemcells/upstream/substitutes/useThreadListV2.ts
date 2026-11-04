// Flying goes by the machine's word, so T3's working shelf, which sorts a running Cell apart from
// the rest, made a Cell between two turns hop over the others and back. Flying keeps T3's one order
// (`stemcells/tasks/home-holds-still-3.md`); `HomeScreen` still reads the preference for reordering.
import { use } from "react";

import * as Upstream from "../../../features/threads/useThreadListV2";
import { HomeStageContext } from "../../home/state";

export * from "../../../features/threads/useThreadListV2";

export function useThreadListV2(input: Parameters<typeof Upstream.useThreadListV2>[0]) {
  const flying = use(HomeStageContext) === "working";
  return Upstream.useThreadListV2(flying ? { ...input, workingShelfEnabled: false } : input);
}
