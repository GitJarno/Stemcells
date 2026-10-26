import { useState, type KeyboardEvent as KeyEvent, type ReactNode } from "react";

import { AutonomyOffer } from "../autonomy/Cards";
import type { Shown } from "./display";
import { answered, useHolds } from "./holds";
import { useLeaving } from "./leaving";
import { holds, leaving } from "./live";
import { answerableOf, NeedCard } from "./NeedCard";
import type { PageView } from "./page";
import { leave, step } from "./walk";

/**
 * The cards still on the list: the person's own answer or settle takes one
 * off at once (stemcells/tasks/left-column-v3.md, decision 7), while what
 * the server changes lingers as the page keeps it.
 */
export function useOnList(view: PageView): ReadonlyArray<Shown> {
  const answers = useHolds(holds);
  const settling = useLeaving(leaving);
  return view.shown.filter(
    (each) => !answered(answers.get(each.need.key)) && !settling.has(each.need.threadId),
  );
}

/**
 * Whether the person is in the list: pointer over it, or keyboard focus in it (not a click's).
 * Native listeners: a chosen option's button leaves the page with focus and pointer on it, so
 * only the browser's focusout says focus went, and with no pointerleave, the pointer is
 * wherever the next pointerover anywhere says.
 */
function watchPerson(onIn: (pointer: boolean | null, focus: boolean | null) => void) {
  return (list: HTMLDivElement | null) => {
    if (list === null) return;
    const focusin = (event: FocusEvent) =>
      onIn(null, event.target instanceof Element && event.target.matches(":focus-visible"));
    const focusout = (event: FocusEvent) => {
      if (!list.contains(event.relatedTarget as Node | null)) onIn(null, false);
    };
    const over = (event: PointerEvent) => onIn(list.contains(event.target as Node | null), null);
    const out = (event: PointerEvent) => {
      if (event.relatedTarget === null) onIn(false, null);
    };
    list.addEventListener("focusin", focusin);
    list.addEventListener("focusout", focusout);
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    return () => {
      list.removeEventListener("focusin", focusin);
      list.removeEventListener("focusout", focusout);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      onIn(false, false);
    };
  };
}

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
 * line once they're gone. `onPerson` hears the pointer and the keyboard's
 * focus come and go, each null when only the other changed.
 */
export function CardList(props: {
  view: PageView;
  head: ReactNode;
  foot?: ReactNode;
  onPerson: (pointer: boolean | null, focus: boolean | null) => void;
  /** Where a card's Open chat goes: a peek, which only Aski's room shows, unless given. */
  openChat?: (threadId: string) => void;
  /**
   * One card open at a time: the one the person opened, else the first that
   * takes an answer, so answering one opens the next. The rest show who
   * asks and what (stemcells/tasks/left-column.md, decision 6).
   */
  queue?: boolean;
}) {
  const answers = useHolds(holds);
  const { view, onPerson } = props;
  const shown = useOnList(view);
  const watch = watchPerson(onPerson);
  const [picked, setPicked] = useState<string | null>(null);
  const waiting = shown
    .filter((each) => answerableOf(each, answers.get(each.need.key)))
    .map((each) => each.need.key);
  const open = picked !== null && waiting.includes(picked) ? picked : (waiting[0] ?? null);
  return (
    <div ref={watch} data-stemcells-needs-list="" onKeyDown={walkKeys}>
      {props.head}
      <AutonomyOffer />
      {shown.map((each) => (
        <NeedCard
          key={each.need.key}
          shown={each}
          hold={answers.get(each.need.key)}
          seenAt={view.seen.get(each.need.key) ?? null}
          openChat={props.openChat}
          queued={
            props.queue
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
