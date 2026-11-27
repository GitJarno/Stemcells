import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  catchAt,
  catchLength,
  cssEasing,
  leapFrames,
  leapOf,
  LIST_MOTION,
} from "../motion/listMotion";
import { takeMovedByHand } from "../needs/byHand";
import { useLeaving } from "../needs/leaving";
import { leaving } from "../needs/live";
import { motionTiming, reducedMotion } from "../tokens/motion";
import { CellMini } from "./CellMini";
import { hopsOf, type Hop, type Standings } from "./moves";

/** Between one hop's start and the next's, so a few read as a line of them. */
const STAGGER_MS = 70;
/** How far above the higher end a hop's arc rises. */
const RISE_PX = 22;
/** A leaping Cell lands this small in Asleep's count, of its own height. */
const LANDING = 0.8;
/** How far Asleep's row gives under the Cell it catches. */
const GIVE_PX = 2.5;
/** A leap taken as the person pressed Sleep stands for that move this long: it doesn't hop again. */
const LEAPT_MS = 60_000;

interface Flight {
  readonly key: string;
  readonly threadId: string;
  /** Where it starts: a card's or row's leading edge, else the old row's Cells. */
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly toStage: Hop["to"];
  readonly delay: number;
}

const centre = (box: DOMRect) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });

const inColumn = (selector: string) =>
  document.querySelector<HTMLElement>(`[data-stemcells-cells] ${selector}`);

/** The Cell's row in its old stage's page while shown: the page it moved to holds its new row, out of sight. */
const rowOf = (hop: Hop) =>
  inColumn(
    `[data-cells-page="${hop.from}"]:not([inert]) [data-cells-thread="${CSS.escape(hop.threadId)}"]`,
  );

/** Where a hop starts: the Cell's own sprite or row while the open list shows it, else its old stage's row. */
const startOf = (hop: Hop) => {
  const own = rowOf(hop);
  const sprite = own?.querySelector("[data-stemcells-cell-status]");
  if (sprite) return centre(sprite.getBoundingClientRect());
  if (own !== null) {
    const box = own.getBoundingClientRect();
    return { x: box.left + 16, y: box.top + Math.min(box.height, 32) / 2 };
  }
  const mark = inColumn(`[data-cells-stage="${hop.from}"] [data-cells-stage-mark]`);
  return mark === null ? null : centre(mark.getBoundingClientRect());
};

/** It dives into its new stage's count. */
const landingOf = (hop: Hop) => inColumn(`[data-cells-stage="${hop.to}"] [data-cells-stage-count]`);

let flown = 0;

/** Whether the move of `threadId` already leapt, as the person pressed Sleep; once. */
function tookLeap(leapt: Map<string, number>, threadId: string) {
  const at = leapt.get(threadId);
  leapt.delete(threadId);
  return at !== undefined && Date.now() - at < LEAPT_MS;
}

/** A flight for `hop`, if its start and its landing are on the page. */
function flightOf(hop: Hop, delay: number): Flight | null {
  const start = startOf(hop);
  const end = landingOf(hop);
  if (start === null || end === null) return null;
  flown += 1;
  return {
    key: `${hop.threadId}:${flown}`,
    threadId: hop.threadId,
    from: start,
    to: centre(end.getBoundingClientRect()),
    toStage: hop.to,
    delay,
  };
}

/**
 * Each Cell the person moved hops from its row into its new stage's count (left-column-v3.md,
 * decision 6): a woken one on the lists' move, a slept one in a leap (`leapOf`). One each, then
 * nothing runs; with less motion, or a move the person didn't make, the counts just change.
 */
export function Hops(props: { standings: Standings; environmentId: string | null }) {
  const before = useRef<Standings | null>(null);
  const [flights, setFlights] = useState<ReadonlyArray<Flight>>([]);
  const { standings, environmentId } = props;
  const sleeping = useLeaving(leaving);
  const sleptBefore = useRef<ReadonlySet<string>>(sleeping);
  const leapt = useRef(new Map<string, number>());

  // A Cell moved again mid-air (a Wake, an undo) leaves its old flight where it is.
  const launch = useEffectEvent((launched: ReadonlyArray<Flight>) => {
    const moved = new Set(launched.map((flight) => flight.threadId));
    if (launched.length > 0)
      setFlights((current) => [
        ...current.filter((flight) => !moved.has(flight.threadId)),
        ...launched,
      ]);
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Measure a slept Cell in its row before its fold paints, and leap from there as the person presses Sleep.
  useLayoutEffect(() => {
    const previous = sleptBefore.current;
    sleptBefore.current = sleeping;
    if (reducedMotion()) return;
    const now = Date.now();
    const slept = [...sleeping].filter((threadId) => !previous.has(threadId));
    launch(
      slept.slice(0, LIST_MOTION.mostAtOnce).flatMap((threadId, index) => {
        const hop = { threadId, from: "awake", to: "asleep" } as const;
        const flight = flightOf(hop, index * STAGGER_MS);
        if (flight === null) return [];
        leapt.current.set(threadId, now);
        // The leap takes the Cell out of its row at once, as the row folds away.
        rowOf(hop)
          ?.querySelector("[data-stemcells-cell-status]")
          ?.animate([{ opacity: 0 }, { opacity: 0 }], {
            duration: index * STAGGER_MS + LIST_MOTION.leave.duration,
          });
        return [flight];
      }),
    );
  }, [sleeping]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Measure the rows before paint to launch hop flights for Cells whose stage changed.
  useLayoutEffect(() => {
    const previous = before.current;
    before.current = standings;
    // The first reading has nothing to move from.
    if (previous === null || previous.size === 0 || reducedMotion()) return;
    const hops = hopsOf(
      previous,
      standings,
      (threadId) => takeMovedByHand(threadId) && !tookLeap(leapt.current, threadId),
    ).slice(0, LIST_MOTION.mostAtOnce);
    launch(
      hops.flatMap((hop, index) => {
        const flight = flightOf(hop, index * STAGGER_MS);
        return flight === null ? [] : [flight];
      }),
    );
  }, [standings]);

  if (environmentId === null || flights.length === 0) return null;
  return createPortal(
    flights.map((flight) => (
      <HopFlight
        key={flight.key}
        flight={flight}
        environmentId={environmentId}
        onLanded={() => setFlights((current) => current.filter((each) => each.key !== flight.key))}
      />
    )),
    document.body,
  );
}

function HopFlight(props: { flight: Flight; environmentId: string; onLanded: () => void }) {
  const { flight } = props;
  const element = useRef<HTMLSpanElement>(null);
  const awake = useRef<HTMLSpanElement>(null);
  const shut = useRef<HTMLSpanElement>(null);
  const landed = useEffectEvent(props.onLanded);
  const sleeps = flight.toStage === "asleep";

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Run the hop animation from measured rects; cancel on unmount.
  useLayoutEffect(() => {
    const sprite = element.current;
    if (sprite === null) return;
    const box = sprite.getBoundingClientRect();
    const hop = sleeps
      ? leapAnimation(sprite, [awake.current, shut.current], box, flight)
      : [flyAnimation(sprite, box, flight)];
    let live = true;
    // A leap is caught as it touches down, then sinks into the count; a flight as it lands.
    const touches = sleeps ? hop[1]! : hop[0]!;
    void touches.finished.then(
      () => {
        if (live) catchIt(flight.toStage);
      },
      () => undefined,
    );
    void hop[0]!.finished.then(
      () => {
        if (live) landed();
      },
      () => undefined,
    );
    return () => {
      live = false;
      for (const each of hop) each.cancel();
    };
  }, [flight, sleeps]);

  return (
    <span ref={element} data-cells-hop="" aria-hidden>
      {sleeps ? (
        <>
          <span ref={shut} data-cells-hop-eyes="">
            <CellMini
              environmentId={props.environmentId}
              threadId={flight.threadId}
              scene="asleep"
            />
          </span>
          <span ref={awake} data-cells-hop-eyes="">
            <CellMini environmentId={props.environmentId} threadId={flight.threadId} />
          </span>
        </>
      ) : (
        <CellMini environmentId={props.environmentId} threadId={flight.threadId} />
      )}
    </span>
  );
}

/** A woken Cell's flight: a low arc on the lists' move. */
function flyAnimation(sprite: HTMLElement, box: DOMRect, flight: Flight): Animation {
  const x0 = flight.from.x - box.width / 2;
  const y0 = flight.from.y - box.height / 2;
  const x1 = flight.to.x - box.width / 2;
  const y1 = flight.to.y - box.height / 2;
  const peak = Math.min(y0, y1) - RISE_PX;
  const at = (x: number, y: number, scale = 1) => ({
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
  });
  const { duration, easing } = LIST_MOTION.move;
  return sprite.animate(
    [
      { ...at(x0, y0), opacity: 0 },
      { ...at(x0, y0), opacity: 1, offset: 0.1 },
      { ...at((x0 + x1) / 2, peak, 1.15), offset: 0.5 },
      at(x1, y1),
    ],
    { duration, delay: flight.delay, easing: cssEasing(easing), fill: "both" },
  );
}

/**
 * A slept Cell's leap, its poses as keyframes run linearly (they carry its gravity); a mark that
 * ends as it touches down; and its open eyes until just past its top, then its shut ones.
 */
function leapAnimation(
  sprite: HTMLElement,
  [open, shut]: readonly [HTMLElement | null, HTMLElement | null],
  box: DOMRect,
  flight: Flight,
): Animation[] {
  const leap = leapOf(
    { ...flight.from, height: box.height },
    { ...flight.to, height: box.height * LANDING },
  );
  const { poses } = leapFrames(leap);
  const timing = {
    duration: leap.total,
    delay: flight.delay,
    easing: "linear",
    fill: "both",
  } as const;
  const hop = sprite.animate(
    poses.map((pose) => ({
      transform: `translate(${pose.x - box.width / 2}px, ${pose.y - box.height / 2}px) rotate(${pose.rotate}deg) scale(${pose.scaleX}, ${pose.scaleY})`,
      opacity: pose.opacity,
    })),
    timing,
  );
  // A step at the moment its eyes close: open shown before it, shut after.
  const at = leap.eyes / leap.total;
  const step = (before: number) => [
    { opacity: before },
    { opacity: before, offset: at },
    { opacity: 1 - before, offset: at },
    { opacity: 1 - before },
  ];
  const touches = sprite.animate([], { duration: leap.contact, delay: flight.delay });
  const eyes = [open?.animate(step(1), timing), shut?.animate(step(0), timing)];
  return [hop, touches, ...eyes.filter((each) => each !== undefined)];
}

/**
 * The stage catches the Cell, once, and its count ticks up. Asleep gives under it and rebounds,
 * like a hammock (`catchAt`), a second catch adding to one under way; Awake's mark nods and its
 * row glows.
 */
function catchIt(stage: Hop["to"]) {
  const row = inColumn(`[data-cells-stage="${stage}"]`);
  if (row === null) return;
  const { duration, easing } = motionTiming("settle");
  const once = { duration, easing };
  row
    .querySelector("[data-cells-stage-count]")
    ?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }],
      once,
    );
  if (stage === "asleep") {
    const length = catchLength();
    const n = Math.ceil(length / (1000 / 60));
    row.animate(
      Array.from({ length: n + 1 }, (_, k) => ({
        translate: `0 ${GIVE_PX * catchAt((length * k) / n)}px`,
      })),
      { duration: length, composite: "add" },
    );
    return;
  }
  row
    .querySelector("[data-cells-stage-mark]")
    ?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.5) translateY(-1px)" },
        { transform: "scale(1)" },
      ],
      once,
    );
  row.animate(
    [
      { boxShadow: "inset 0 0 0 999px var(--sc-hot)" },
      { boxShadow: "inset 0 0 0 999px transparent" },
    ],
    { duration: duration * 2, easing },
  );
}
