/**
 * The assistant reply a chat's row draws, for the words inside it: its close-out draws as a card
 * (stemcells/tasks/close-out-card.md). A reply still streaming, or words that aren't a reply's
 * own, stay as written.
 */
import { createContext } from "react";

import {
  writtenCloseOut,
  type WrittenCloseOut,
} from "../../../../../stemcells/closeOut/closeOut.ts";

export interface Reply {
  /** Its words once settled: only the markdown drawing exactly these is the reply. */
  readonly text: string;
  readonly runId: string | null;
  /** Its run's last reply, the run over. */
  readonly last: boolean;
}

/** Set by the row that draws an assistant's reply (`upstream/substitutes/TimelineAssistantRows.tsx`). */
export const ReplyInView = createContext<Reply | null>(null);

// A transcript mounts a reply again each time it scrolls into view: read each once.
const READ_KEPT = 256;
const read = new Map<string, WrittenCloseOut | null>();

function closeOutIn(text: string): WrittenCloseOut | null {
  const known = read.get(text);
  if (known !== undefined) return known;
  if (read.size >= READ_KEPT) read.delete(read.keys().next().value!);
  const closeOut = writtenCloseOut(text);
  read.set(text, closeOut);
  return closeOut;
}

/** The close-out `text` draws as a card, or null to draw its words as written. */
export function cardOf(
  reply: Reply | null,
  text: string,
  streaming: boolean,
): WrittenCloseOut | null {
  if (reply === null || streaming || reply.text !== text) return null;
  return closeOutIn(text);
}

/** Whether the server's standing for a Cell is about this reply: its latest run's last. */
export const isLatest = (reply: Reply, latestRunId: string | null): boolean =>
  reply.last && reply.runId !== null && reply.runId === latestRunId;
