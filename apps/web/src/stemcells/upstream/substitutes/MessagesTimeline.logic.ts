// Replaces `components/chat/MessagesTimeline.logic.ts` (`plugin.ts`): a row
// that reads another Cell names it, "Read Cell “Title”", where upstream's
// says "Read thread “…”". Upstream finds that row by how its label ends,
// and the label is now ours (`stemcells/words/cellTools.ts`).
import type * as Upstream from "../../../components/chat/MessagesTimeline.logic";

import { CELL_TOOL_LABELS } from "../../../../../../stemcells/words/cellTools.ts";

export * from "../../../components/chat/MessagesTimeline.logic";

/** How a Cell read's label ends ("Read a Cell"), the part the title replaces. */
const CELL_READ_OBJECT = ` ${CELL_TOOL_LABELS.t3_thread_read![3]}`;

export const threadReadLabelPrefix: typeof Upstream.threadReadLabelPrefix = (label) =>
  label.endsWith(CELL_READ_OBJECT) ? `${label.slice(0, -CELL_READ_OBJECT.length)} Cell` : null;
