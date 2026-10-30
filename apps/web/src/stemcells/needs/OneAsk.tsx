import { useLayoutEffect, useRef, useState } from "react";

import { CellMark } from "../tabs/CellMark";
import { useNowMinuteMs, usePrimaryEnvironmentId } from "../upstream/needs";
import { cardOf, whenOf } from "./card";
import type { Shown } from "./display";
import { lineUp } from "./front";
import type { Hold } from "./holds";
import { pullBack, useLater } from "./live";
import { answerableOf, NeedCard, plainOf, whoOf } from "./NeedCard";
import { bowOut, offLeft, offRight, slide, walk, walkMs } from "./stroll";
import { land, leave } from "./walk";
import type { Need } from "./wire";

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
 * a line of their Cells along the bottom, those put off dimmed at its end, and every seat
 * change on foot. The front's own seat stays in the line, unseen, so the Cell that leaves the
 * line for the front walks off it.
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
  const later = useLater();

  const leaving =
    seat.left === null || waiting.some((each) => each.need.key === seat.left)
      ? null
      : (props.shown.find((each) => each.need.key === seat.left) ?? null);
  // Later sends it off the way it came, round to the end of the line; anything else is off to work.
  const back =
    leaving !== null &&
    props.answers.get(leaving.need.key)?.commands.some((command) => command.type === "snooze");

  const root = useRef<HTMLDivElement>(null);
  const placed = useRef<ReadonlyMap<string, number> | null>(null);
  const stood = useRef<string | null>(null);
  const seats = [...(front === null ? [] : [front]), ...line];
  const bringForward = (key: string) => setSeat({ front: key, left: seat.front });
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
    let gone = 0;
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
      const exit = element.querySelector("[data-need-exit] [data-need-mark]");
      if (exit !== null && back) {
        const off = offLeft(exit, stage);
        walk(exit, { from: 0, to: off, off: true });
        gone = walkMs(off);
      } else if (exit !== null) bowOut(exit);
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
        walk(chair, {
          from: offRight(chair, stage),
          to: 0,
          delay: Math.max(arrives, gone) + STAGGER_MS,
        });
      else if (Math.abs(from - chair.offsetLeft) > 0.5)
        walk(chair, { from: from - chair.offsetLeft, to: 0, delay: index * STAGGER_MS });
    });
  });

  const markOf = (need: Need) =>
    environmentId === null ? (
      need.number
    ) : (
      <CellMark cell={{ environmentId, threadId: need.threadId, draftId: null }} />
    );
  const peekOn = (key: string) => ({
    onPointerEnter: () => setPeek(key),
    onPointerLeave: () => setPeek(null),
    onFocus: () => setPeek(key),
    onBlur: () => setPeek(null),
  });
  const peeked = line.find((each) => each.need.key === peek) ?? null;
  const peekedLater = later.find((need) => need.key === peek) ?? null;
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
      {seats.length + later.length > 0 ? (
        <div data-needs-line="" data-empty={line.length === 0 || undefined}>
          <div data-needs-seats="">
            {seats.map((each) => {
              const inFront = each === front;
              return (
                <button
                  key={each.need.key}
                  type="button"
                  data-need-seat={each.need.key}
                  data-in-front={inFront || undefined}
                  inert={inFront}
                  aria-label={`${each.need.number} ${whoOf(each.need)}`}
                  onClick={() => bringForward(each.need.key)}
                  {...peekOn(each.need.key)}
                >
                  {markOf(each.need)}
                </button>
              );
            })}
            {line.length > 0 ? <span data-needs-more="">{line.length} more</span> : null}
            {later.map((need) => (
              <button
                key={need.key}
                type="button"
                data-need-seat={need.key}
                data-later=""
                aria-label={`${whoOf(need)}, later, back ${whenOf(need.until, now)}`}
                onClick={() => {
                  pullBack(need);
                  bringForward(need.key);
                }}
                {...peekOn(need.key)}
              >
                {markOf(need)}
              </button>
            ))}
          </div>
          <p data-needs-peek="" aria-live="polite">
            {peeked !== null ? (
              <>
                <span data-need-number="">{peeked.need.number}</span>
                {`${whoOf(peeked.need)} · ${plainOf(cardOf(peeked.need, now, null).headline)}`}
              </>
            ) : peekedLater !== null ? (
              `${whoOf(peekedLater)} · ${plainOf(cardOf(peekedLater, now, null).headline)} · back ${whenOf(peekedLater.until, now)}`
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
