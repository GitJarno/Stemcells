import { defaultInstanceIdForDriver, ProviderDriverKind } from "../upstream/compaction";
import { COMPACTION_SEARCH_ITEMS } from "./search";

/**
 * The provider instance a settings search lands on: the default Claude's,
 * whose Runtime section holds the compaction row, when the search named it.
 * Settings › Providers shows one instance at a time, so without it a search
 * would land on whichever instance comes first.
 */
export function searchedInstanceId(searchTargetId: string | null) {
  return COMPACTION_SEARCH_ITEMS.some((item) => item.id === searchTargetId)
    ? defaultInstanceIdForDriver(ProviderDriverKind.make("claudeAgent"))
    : undefined;
}
