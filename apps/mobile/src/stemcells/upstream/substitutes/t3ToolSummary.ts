// Replaces `@t3tools/client-runtime/t3ToolSummary` (`substitutes.cjs`): the work
// log sums up a run of calls to T3's own tools in Cell words
// (`stemcells/words/cellTools.ts`).
import * as Upstream from "@t3tools/client-runtime/t3ToolSummary";

import { inCellWords } from "../../../../../../stemcells/words/cellTools.ts";

export * from "@t3tools/client-runtime/t3ToolSummary";

export const summarizeT3ToolCalls: typeof Upstream.summarizeT3ToolCalls = (action, calls) => {
  const summary = Upstream.summarizeT3ToolCalls(action, calls);
  return { ...summary, label: inCellWords(summary.label) };
};
