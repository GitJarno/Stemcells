/**
 * The work verbs in upstream's chat timeline: its working row says the
 * running turn's verb where it said "Working", lit by the composer's wave,
 * and a finished turn's fold its past form where it said "Worked". Upstream
 * keeps its row, its timer and its layout. A screen reader hears upstream's
 * plain words.
 *
 * The rows read the chat's verbs from `TurnVerbsProvider`, which the
 * timeline's substitute puts round upstream's timeline with the entries it
 * draws, so upstream's own row state carries nothing of ours. Without one,
 * the rows say upstream's words.
 */
import { createContext, use, type ReactNode } from "react";

import { WorkingSheen } from "../glow/WorkingSheen";
import type { TimelineEntries } from "../upstream/workVerbs";
import { turnVerbsOf, type TurnVerbs } from "./turnVerbs";
import { workedLabel, workingWord } from "./workVerbs";

export { turnVerbsOf, type TurnVerbs } from "./turnVerbs";

const TurnVerbsContext = createContext<TurnVerbs | null>(null);

/** The chat's verbs, read off the timeline's entries, for the rows inside. */
export function TurnVerbsProvider({
  entries,
  children,
}: {
  readonly entries: TimelineEntries;
  readonly children: ReactNode;
}) {
  // The same object while the chat's turns are the same (`turnVerbsOf`), so
  // a row redraws only when a turn starts, never on every streamed word.
  return <TurnVerbsContext value={turnVerbsOf(entries)}>{children}</TurnVerbsContext>;
}

/** "Noodling", where upstream's working row said "Working", lit while it works. */
export function CellWorkingWord() {
  const verbs = use(TurnVerbsContext);
  const shown = workingWord(verbs?.live ?? null);
  return <Said shown={shown} plain={workingWord(null)} as={<WorkingSheen>{shown}</WorkingSheen>} />;
}

/** "Noodled for 3m 12s", where upstream's fold said "Worked for 3m 12s". */
export function CellWorkedLabel({
  createdAt,
  label,
}: {
  readonly createdAt: string;
  readonly label: string;
}) {
  const verbs = use(TurnVerbsContext);
  return <Said shown={workedLabel(verbs?.at(createdAt) ?? null, label)} plain={label} />;
}

/**
 * Words shown one way and read aloud another; plain when they're the same.
 * The plain words come first, so the row's text still starts with upstream's.
 * `as` draws the shown words, when they wear more than their text.
 */
function Said({
  shown,
  plain,
  as = shown,
}: {
  readonly shown: string;
  readonly plain: string;
  readonly as?: ReactNode;
}) {
  if (shown === plain) return as;
  return (
    <>
      <span className="sr-only select-none">{plain}</span>
      <span aria-hidden="true">{as}</span>
    </>
  );
}
