/**
 * The work verbs in upstream's chat timeline: its working row says the
 * running turn's verb where it said "Working", and a finished turn's fold
 * its past form where it said "Worked". Upstream keeps its row, its timer
 * and its layout. A screen reader hears upstream's plain words.
 */
import type { TurnVerbs } from "./turnVerbs";
import { workedLabel, workingWord } from "./workVerbs";

export { turnVerbsOf, type TurnVerbs } from "./turnVerbs";

/** "Noodling", where upstream's working row said "Working". */
export function CellWorkingWord({ verbs }: { readonly verbs: TurnVerbs }) {
  return <Said shown={workingWord(verbs.live)} plain={workingWord(null)} />;
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
 */
function Said({ shown, plain }: { readonly shown: string; readonly plain: string }) {
  if (shown === plain) return plain;
  return (
    <>
      <span className="sr-only select-none">{plain}</span>
      <span aria-hidden="true">{shown}</span>
    </>
  );
}
