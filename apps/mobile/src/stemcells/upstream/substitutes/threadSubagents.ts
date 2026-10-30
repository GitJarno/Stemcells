// Replaces `@t3tools/client-runtime/state/thread-subagents` (`substitutes.cjs`):
// the composer's pill for a turn's Subcells reads them aloud as Subcells where
// upstream says agents ("2 of 3 Subcells flying"; `stemcells/words/subcells.ts`).
import * as Upstream from "@t3tools/client-runtime/state/thread-subagents";

import { inSubcellCountWords } from "../../../../../../stemcells/words/subcells.ts";

export * from "@t3tools/client-runtime/state/thread-subagents";

export const resolveSubagentPillSegment: typeof Upstream.resolveSubagentPillSegment = (turn) => {
  const segment = Upstream.resolveSubagentPillSegment(turn);
  return segment === null
    ? null
    : { ...segment, accessibilityLabel: inSubcellCountWords(segment.accessibilityLabel) };
};
