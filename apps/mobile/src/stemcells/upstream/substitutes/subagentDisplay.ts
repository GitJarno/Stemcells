// Replaces `@t3tools/client-runtime/state/subagent-display` (`substitutes.cjs`):
// a subagent with no title of its own is a Subcell, and a card's Subcells at
// work are flying (`stemcells/words/subcells.ts`).
import * as Upstream from "@t3tools/client-runtime/state/subagent-display";

import {
  UNTITLED_SUBAGENT,
  inFlyingWords,
  inSubcellWords,
} from "../../../../../../stemcells/words/subcells.ts";

export * from "@t3tools/client-runtime/state/subagent-display";

export const formatSubagentDisplayTitle: typeof Upstream.formatSubagentDisplayTitle = (title) => {
  const shown = Upstream.formatSubagentDisplayTitle(title);
  return shown === UNTITLED_SUBAGENT ? inSubcellWords(shown) : shown;
};

export const summarizeSubagentStatuses: typeof Upstream.summarizeSubagentStatuses = (statuses) =>
  inFlyingWords(Upstream.summarizeSubagentStatuses(statuses));
