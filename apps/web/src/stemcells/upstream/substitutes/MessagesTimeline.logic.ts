// Replaces `components/chat/MessagesTimeline.logic.ts` (`plugin.ts`):
// - a row that reads another Cell names it, "Read Cell “Title”", where
//   upstream's says "Read thread “…”". Upstream finds that row by how its
//   label ends, and the label is now ours (`stemcells/words/cellTools.ts`).
// - a Cell that carried on after a usage limit shows "Continued after …"
//   where its continuation message would be: the line was the app's, not
//   the person's (`stemcells/limitResume/row.ts`). The row is a notice, as
//   Claude's own notices are. Why here, of all places: stemcells/seams.md,
//   "A Cell carries on after a usage limit".
// - a message this Cell sent another with `t3_thread_send` says what it did,
//   to whom: "Asked Otter: Can I take 0043?" (stemcells/tasks/peers.md,
//   decision 4).
import type * as Upstream from "../../../components/chat/MessagesTimeline.logic";
import {
  deriveMessagesTimelineRowsWithState as upstreamRowsWithState,
  workEntryDisplayLabel as upstreamDisplayLabel,
} from "../../../components/chat/MessagesTimeline.logic";
import type { WorkLogEntry } from "../../../session-logic";

import { CELL_TOOL_LABELS } from "../../../../../../stemcells/words/cellTools.ts";
import { continuedWords } from "../../limitResume/row";
import { sentOf } from "../../peers/exchange";
import { sentLabel } from "../../peers/names";

export * from "../../../components/chat/MessagesTimeline.logic";

/** How a Cell read's label ends ("Read a Cell"), the part the title replaces. */
const CELL_READ_OBJECT = ` ${CELL_TOOL_LABELS.t3_thread_read![3]}`;

export const threadReadLabelPrefix: typeof Upstream.threadReadLabelPrefix = (label) =>
  label.endsWith(CELL_READ_OBJECT) ? `${label.slice(0, -CELL_READ_OBJECT.length)} Cell` : null;

export const workEntryDisplayLabel: typeof Upstream.workEntryDisplayLabel = (
  entry,
  workspaceRoot,
) => {
  const sent = sentOf(entry.structuredPayload);
  return sent === null ? upstreamDisplayLabel(entry, workspaceRoot) : sentLabel(sent);
};

type Row = Upstream.MessagesTimelineRow;

/**
 * A continuation's message as a notice row. A fresh row each time: upstream's
 * `computeStableMessagesTimelineRows` keeps the one already drawn while its
 * entries are equal.
 */
function continuedRow(row: Row): Row {
  if (row.kind !== "message" || row.message.role !== "user") return row;
  const words = continuedWords(row.message.id);
  if (words === null) return row;
  const entry: WorkLogEntry = {
    id: row.id,
    createdAt: row.createdAt,
    runId: row.message.runId ?? null,
    label: words,
    tone: "info",
    itemType: "system_notice",
  };
  return {
    kind: "work",
    id: row.id,
    createdAt: row.createdAt,
    groupedEntries: [entry],
    isExpandedToolGroup: false,
  };
}

export const deriveMessagesTimelineRowsWithState: typeof Upstream.deriveMessagesTimelineRowsWithState =
  (input, previous) => {
    const projection = upstreamRowsWithState(input, previous);
    let changed = false;
    const rows = projection.rows.map((row) => {
      const next = continuedRow(row);
      if (next !== row) changed = true;
      return next;
    });
    return changed ? { ...projection, rows } : projection;
  };
