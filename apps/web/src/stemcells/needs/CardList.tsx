import type { KeyboardEvent as KeyEvent, ReactNode } from "react";

import { AutonomyOffer } from "../autonomy/Cards";
import type { Shown } from "./display";
import { useAnswers } from "./answering";
import { answering } from "./live";
import { OneAsk } from "./OneAsk";
import type { PageView } from "./page";
import { leave, step } from "./walk";

/**
 * The cards still asking. One the person answered or settled leaves the page's list at once
 * (`live.ts`), as one whose need is gone does, and folds away (unblocking.md, decision 7).
 */
export const onListOf = (view: PageView): ReadonlyArray<Shown> =>
  view.shown.filter((each) => each.goneAt === null);

// ↓ and ↑ step card to card, Esc goes back to Aski's composer (walk.ts); a
// field's keys are its own. A held Enter answers one card, not each it
// steps on to; Esc stays unhandled, so a peek over the room closes too.
function walkKeys(event: KeyEvent<HTMLDivElement>) {
  if (event.key === "Enter" && event.repeat) return event.preventDefault();
  if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, [contenteditable='true']")) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (step(target, event.key === "ArrowDown" ? 1 : -1)) event.preventDefault();
  } else if (event.key === "Escape") {
    leave(target);
  }
}

/**
 * The asks in Aski's room, one at a time (`OneAsk.tsx`): the offer to let Aski take some, the ask
 * in front, and the all-clear line once they're gone.
 */
export function CardList(props: { view: PageView; head: ReactNode; foot?: ReactNode }) {
  const answers = useAnswers(answering);
  const { view } = props;
  return (
    <div data-stemcells-needs-list="" onKeyDown={walkKeys}>
      {props.head}
      <AutonomyOffer />
      <OneAsk shown={view.shown} answers={answers} seen={view.seen} />
      {view.cleared !== null ? <p data-needs-cleared="">{view.cleared}</p> : null}
      {props.foot}
    </div>
  );
}
