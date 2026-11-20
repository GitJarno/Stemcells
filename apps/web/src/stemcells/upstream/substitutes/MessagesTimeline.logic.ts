// Replaces `components/chat/MessagesTimeline.logic.ts` (`plugin.ts`). A Cell that
// carried on after a usage limit shows "Continued after …" as a notice: the line was the app's
// (seams.md, "A Cell carries on after a usage limit"). A `t3_thread_send` says "Asked Otter: …".
import type * as Upstream from "../../../components/chat/MessagesTimeline.logic";
import {
  deriveMessagesTimelineRowsWithState as upstreamRowsWithState,
  workEntryDisplayLabel as upstreamDisplayLabel,
} from "../../../components/chat/MessagesTimeline.logic";
import type { WorkLogEntry } from "../../../session-logic";

import { continuedWords } from "../../limitResume/row";
import { sentOf } from "../../peers/exchange";
import { sentLabel } from "../../peers/names";

export * from "../../../components/chat/MessagesTimeline.logic";

export const workEntryDisplayLabel: typeof Upstream.workEntryDisplayLabel = (
  entry,
  workspaceRoot,
  resolve,
) => {
  const sent = sentOf(entry.structuredPayload);
  return sent === null ? upstreamDisplayLabel(entry, workspaceRoot, resolve) : sentLabel(sent);
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
  (input, previous, resolve) => {
    const projection = upstreamRowsWithState(input, previous, resolve);
    let changed = false;
    const rows = projection.rows.map((row) => {
      const next = continuedRow(row);
      if (next !== row) changed = true;
      return next;
    });
    return changed ? { ...projection, rows } : projection;
  };
