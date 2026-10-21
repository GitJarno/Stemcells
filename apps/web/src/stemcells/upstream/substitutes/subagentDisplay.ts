// Replaces `@t3tools/client-runtime/state/subagent-display` (`plugin.ts`): a
// model's name is concise (`../modelNames`), and a subagent with no title of
// its own is a Subcell (`stemcells/words/subcells.ts`).
import * as Upstream from "@t3tools/client-runtime/state/subagent-display";

import { UNTITLED_SUBAGENT, inSubcellWords } from "../../../../../../stemcells/words/subcells.ts";

export * from "@t3tools/client-runtime/state/subagent-display";
export { resolveSubagentMetadata } from "../modelNames";

export const formatSubagentDisplayTitle: typeof Upstream.formatSubagentDisplayTitle = (title) => {
  const shown = Upstream.formatSubagentDisplayTitle(title);
  return shown === UNTITLED_SUBAGENT ? inSubcellWords(shown) : shown;
};
