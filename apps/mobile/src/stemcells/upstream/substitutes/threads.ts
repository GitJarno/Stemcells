// Replaces `@t3tools/client-runtime/state/threads` (`substitutes.cjs`): the line
// over Subcells waiting on the person says Subcell where upstream says subagent
// ("2 Subcells need approval"; `stemcells/words/subcells.ts`).
import * as Upstream from "@t3tools/client-runtime/state/threads";

import { inSubcellWords } from "../../../../../../stemcells/words/subcells.ts";

export * from "@t3tools/client-runtime/state/threads";

export const childThreadInputsTitle: typeof Upstream.childThreadInputsTitle = (children) =>
  inSubcellWords(Upstream.childThreadInputsTitle(children));
