// Replaces `@t3tools/client-runtime/state/subagentRuntime` (`plugin.ts`): a
// workflow's heading counts its Subcells where upstream counts agents, those at
// work flying ("3 Subcells · 2 flying · 1 done"; `stemcells/words/subcells.ts`).
import * as Upstream from "@t3tools/client-runtime/state/subagentRuntime";

import { inSubcellCountWords } from "../../../../../../stemcells/words/subcells.ts";

export * from "@t3tools/client-runtime/state/subagentRuntime";

export const workflowOpeningHeadline: typeof Upstream.workflowOpeningHeadline = (opening) => {
  const headline = Upstream.workflowOpeningHeadline(opening);
  return {
    ...headline,
    agents: headline.agents === null ? null : inSubcellCountWords(headline.agents),
  };
};
