/**
 * The work verbs in upstream's chat timeline: its working row says the
 * running turn's verb where it said "Working", lit by the composer's wave,
 * and a finished turn's fold its past form where it said "Worked". Upstream
 * keeps its row, its timer and its layout. A screen reader hears upstream's
 * plain words.
 */
import type { ReactNode } from "react";

import { WorkingSheen } from "../glow/WorkingSheen";
import type { TurnVerbs } from "./turnVerbs";
import { workedLabel, workingWord } from "./workVerbs";

export { turnVerbsOf, type TurnVerbs } from "./turnVerbs";

/** "Noodling", where upstream's working row said "Working", lit while it works. */
export function CellWorkingWord({ verbs }: { readonly verbs: TurnVerbs }) {
  const shown = workingWord(verbs.live);
  return <Said shown={shown} plain={workingWord(null)} as={<WorkingSheen>{shown}</WorkingSheen>} />;
}

/** "Noodled for 3m 12s", where upstream's fold said "Worked for 3m 12s". */
export function CellWorkedLabel({
  verbs,
  createdAt,
  label,
}: {
  readonly verbs: TurnVerbs;
  readonly createdAt: string;
  readonly label: string;
}) {
  return <Said shown={workedLabel(verbs.at(createdAt), label)} plain={label} />;
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
