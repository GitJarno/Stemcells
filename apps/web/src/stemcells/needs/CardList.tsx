import { useState, type KeyboardEvent as KeyEvent, type ReactNode } from "react";

import { AutonomyOffer } from "../autonomy/Cards";
import type { Shown } from "./display";
import { useHolds } from "./holds";
import { holds } from "./live";
import { answerableOf, NeedCard } from "./NeedCard";
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
 * The cards of what needs the person, as Aski's room and the Cells' column
 * show them: the offer to let Aski take some, each card, and the all-clear
 * line once they're gone. A card on its way off folds, and the list closes up.
 */
export function CardList(props: {
  view: PageView;
  head: ReactNode;
  foot?: ReactNode;
  /** Where a card's Open chat goes: a peek, which only Aski's room shows, unless given. */
  openChat?: (threadId: string) => void;
  /**
   * One card open at a time: the one the person opened, else the first that
   * takes an answer, so answering one opens the next. The rest show who
   * asks and what (stemcells/tasks/left-column.md, decision 6).
   */
  queue?: boolean;
  /**
   * Every card folded, an index of asks shown open elsewhere: opening one
   * calls this instead (stemcells/tasks/aski-asks.md, decision 8).
   */
  reveal?: ((key: string) => void) | undefined;
  /** The asks this list shows, when not every one: the column's project filter. */
  only?: ((shown: Shown) => boolean) | undefined;
}) {
  const answers = useHolds(holds);
  const { view, only } = props;
  const shown = only ? view.shown.filter(only) : view.shown;
  const [picked, setPicked] = useState<string | null>(null);
  const waiting = shown
    .filter((each) => each.goneAt === null && answerableOf(each, answers.get(each.need.key)))
    .map((each) => each.need.key);
  const open = picked !== null && waiting.includes(picked) ? picked : (waiting[0] ?? null);
  return (
    <div data-stemcells-needs-list="" onKeyDown={walkKeys}>
      {props.head}
      <AutonomyOffer />
      {shown.map((each) => (
        <NeedCard
          key={each.need.key}
          shown={each}
          leaving={each.goneAt !== null}
          hold={answers.get(each.need.key)}
          seenAt={view.seen.get(each.need.key) ?? null}
          openChat={props.openChat}
          queued={
            props.reveal
              ? { open: false, onOpen: () => props.reveal?.(each.need.key) }
              : props.queue
                ? { open: each.need.key === open, onOpen: () => setPicked(each.need.key) }
                : undefined
          }
        />
      ))}
      {view.cleared !== null ? <p data-needs-cleared="">{view.cleared}</p> : null}
      {props.foot}
    </div>
  );
}
