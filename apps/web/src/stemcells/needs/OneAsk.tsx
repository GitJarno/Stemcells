import { useLayoutEffect, useRef, useState } from "react";

import { CellMark } from "../tabs/CellMark";
import { useNowMinuteMs, usePrimaryEnvironmentId } from "../upstream/needs";
import { cardOf } from "./card";
import type { Shown } from "./display";
import { lineUp } from "./front";
import type { Hold } from "./holds";
import { answerableOf, NeedCard, plainOf, whoOf } from "./NeedCard";
import { bowOut, offLeft, offRight, slide, walk, walkMs } from "./stroll";
import { land, leave } from "./walk";

/** Between one Cell's step up the line and the next's, front first. */
const STAGGER_MS = 45;
/** Where the line's count stood, beside the seats'. */
const MORE = " more";

interface Seat {
  /** Who stands in front, kept there until it goes. */
  readonly front: string | null;
  /** Who stood there before: answered, it walks off over the new one. */
  readonly left: string | null;
}

/**
 * Aski's room one ask at a time (stemcells/tasks/one-ask.md): the ask in front whole, the rest
 * a line of their Cells along the bottom, and every seat change on foot. The front's own seat
 * stays in the line, unseen, so the Cell that leaves the line for the front walks off it.
 */
export function OneAsk(props: {
  shown: ReadonlyArray<Shown>;
  answers: ReadonlyMap<string, Hold>;
  seen: ReadonlyMap<string, number>;
  openChat?: ((threadId: string) => void) | undefined;
}) {
  const environmentId = usePrimaryEnvironmentId();
  const now = useNowMinuteMs();
  const waiting = props.shown.filter((each) =>
    answerableOf(each, props.answers.get(each.need.key)),
  );
  const [seat, setSeat] = useState<Seat>({ front: null, left: null });
  const { front, line } = lineUp(waiting, seat.front);
  const frontKey = front?.need.key ?? null;
  if (frontKey !== seat.front) setSeat({ front: frontKey, left: seat.front });
  const [peek, setPeek] = useState<string | null>(null);

  const leaving =
    seat.left === null || waiting.some((each) => each.need.key === seat.left)
      ? null
      : (props.shown.find((each) => each.need.key === seat.left) ?? null);
  // Later sends it back the way it came; anything else is off to work.
  const back =
    leaving !== null &&
    props.answers.get(leaving.need.key)?.commands.some((command) => command.type === "snooze");

  const root = useRef<HTMLDivElement>(null);
  const placed = useRef<ReadonlyMap<string, number> | null>(null);
  const stood = useRef<string | null>(null);
  const seats = [...(front === null ? [] : [front]), ...line];
  // Each render reads where the seats stand; only a Cell whose seat moved walks.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Walk the Cells to their new seats before paint, from where the last layout stood them.
  useLayoutEffect(() => {
    const element = root.current;
    if (element === null) return;
    const before = placed.current;
    const was = stood.current;
    const chairs = [...element.querySelectorAll<HTMLElement>("[data-need-seat]")];
    const more = element.querySelector<HTMLElement>("[data-needs-more]");
    placed.current = new Map([
      ...chairs.flatMap((chair): Array<[string, number]> =>
        chair.hasAttribute("data-in-front") ? [] : [[chair.dataset.needSeat!, chair.offsetLeft]],
      ),
      ...(more === null ? [] : [[MORE, more.offsetLeft] as [string, number]]),
    ]);
    stood.current = frontKey;
    if (before === null) return;
    const stage =
      element.closest("[data-stemcells-needs-column], [data-stemcells-needs-sheet]") ?? element;
    const mark = element.querySelector(
      "[data-need-front] > [data-stemcells-need] [data-need-mark]",
    );
    let arrives = 0;
    if (frontKey !== was) {
      const from = frontKey === null ? undefined : before.get(frontKey);
      const chair = chairs.find((each) => each.hasAttribute("data-in-front"));
      // It leaves the line from where it stood, by the line's left edge.
      if (chair !== undefined && from !== undefined) {
        chair.style.insetInlineStart = `${from}px`;
        const off = offLeft(chair, stage);
        walk(chair, { from: 0, to: off, off: true });
        arrives = walkMs(off);
      }
      if (mark !== null) walk(mark, { from: offLeft(mark, stage), to: 0, delay: arrives });
      const gone = element.querySelector("[data-need-exit] [data-need-mark]");
      if (gone !== null && back) walk(gone, { from: 0, to: offLeft(gone, stage), off: true });
      else if (gone !== null) bowOut(gone);
      // The keyboard answered the last one: it meets the next where it lands.
      if (element.hasAttribute("data-land-next")) {
        element.removeAttribute("data-land-next");
        const next = element.querySelector<HTMLElement>(
          "[data-need-front] > [data-stemcells-need]",
        );
        if (next === null) leave(element);
        else land(next);
      }
    }
    const counted = more === null ? undefined : before.get(MORE);
    if (more !== null && counted !== undefined && Math.abs(counted - more.offsetLeft) > 0.5)
      slide(more, counted - more.offsetLeft, chairs.length * STAGGER_MS);
    chairs.forEach((chair, index) => {
      if (chair.hasAttribute("data-in-front")) return;
      const from = before.get(chair.dataset.needSeat!);
      if (from === undefined)
        walk(chair, { from: offRight(chair, stage), to: 0, delay: arrives + STAGGER_MS });
      else if (Math.abs(from - chair.offsetLeft) > 0.5)
        walk(chair, { from: from - chair.offsetLeft, to: 0, delay: index * STAGGER_MS });
    });
  });

  const cellOf = (threadId: string) =>
    environmentId === null ? null : { environmentId, threadId, draftId: null };
  const peeked = line.find((each) => each.need.key === peek) ?? null;
  return (
    <div ref={root} data-needs-one="">
      <div data-need-front="">
        {leaving !== null ? (
          <div data-need-exit="" data-back={back || undefined} inert>
            <NeedCard
              key={leaving.need.key}
              shown={leaving}
              leaving={false}
              hold={props.answers.get(leaving.need.key)}
              seenAt={null}
            />
          </div>
        ) : null}
        {front !== null ? (
          <NeedCard
            key={front.need.key}
            shown={front}
            leaving={false}
            hold={props.answers.get(front.need.key)}
            seenAt={props.seen.get(front.need.key) ?? null}
            landed
            openChat={props.openChat}
          />
        ) : null}
      </div>
      {seats.length > 0 ? (
        <div data-needs-line="" data-empty={line.length === 0 || undefined}>
          <div data-needs-seats="">
            {seats.map((each) => {
              const inFront = each === front;
              const cell = cellOf(each.need.threadId);
              return (
                <button
                  key={each.need.key}
                  type="button"
                  data-need-seat={each.need.key}
                  data-in-front={inFront || undefined}
                  inert={inFront}
                  aria-label={`${each.need.number} ${whoOf(each.need)}`}
                  onClick={() => setSeat({ front: each.need.key, left: seat.front })}
                  onPointerEnter={() => setPeek(each.need.key)}
                  onPointerLeave={() => setPeek(null)}
                  onFocus={() => setPeek(each.need.key)}
                  onBlur={() => setPeek(null)}
                >
                  {cell === null ? each.need.number : <CellMark cell={cell} />}
                </button>
              );
            })}
            {line.length > 0 ? <span data-needs-more="">{line.length} more</span> : null}
          </div>
          <p data-needs-peek="" aria-live="polite">
            {peeked === null ? null : (
              <>
                <span data-need-number="">{peeked.need.number}</span>
                {`${whoOf(peeked.need)} · ${plainOf(cardOf(peeked.need, now, null).headline)}`}
              </>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
