import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { motionTiming, reducedMotion } from "../tokens/motion";
import { CellMini } from "./CellMini";
import { hopsOf, type Hop, type Standings } from "./moves";

/** More Cells than this moving at once (Settle all) hop the first few; the rest just arrive. */
const MOST_AT_ONCE = 4;
/** Between one hop's start and the next's, so a few read as a line of them. */
const STAGGER_MS = 70;
/** How far above the higher end a hop's arc rises. */
const RISE_PX = 22;

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

/** Where a hop starts: the Cell's own card or row while the open list shows it, else its old stage's row. */
const startOf = (hop: Hop) => {
  const id = CSS.escape(hop.threadId);
  const own = inColumn(`[data-cells-thread="${id}"], [data-need-thread="${id}"]`);
  if (own !== null) {
    const box = own.getBoundingClientRect();
    return { x: box.left + 16, y: box.top + Math.min(box.height, 32) / 2 };
  }
  const row = inColumn(`[data-cells-stage="${hop.from}"] [data-cells-stage-minis]`);
  return row === null ? null : centre(row.getBoundingClientRect());
};

/** The Cell's own place among its new stage's few, else where they stand. */
const landingOf = (hop: Hop) =>
  inColumn(`[data-cells-stage="${hop.to}"] [data-cells-mini="${CSS.escape(hop.threadId)}"]`) ??
  inColumn(`[data-cells-stage="${hop.to}"] [data-cells-stage-minis]`);

let flown = 0;

/**
 * Each Cell that moves along the line hops there (stemcells/tasks/
 * left-column.md, decision 7): from its card or row, or its old stage's row,
 * down to its new stage's row, whose count bumps as it lands. One arc each,
 * then nothing runs; with less motion the counts just change.
 */
export function Hops(props: { standings: Standings; environmentId: string | null }) {
  const before = useRef<Standings | null>(null);
  const [flights, setFlights] = useState<ReadonlyArray<Flight>>([]);
  const { standings, environmentId } = props;

  // oxlint-disable-next-line t3code/react-effect-budget -- Measure the rows before paint to launch hop flights for Cells whose stage changed.
  useLayoutEffect(() => {
    const previous = before.current;
    before.current = standings;
    // The first reading has nothing to move from.
    if (previous === null || previous.size === 0 || reducedMotion()) return;
    const hops = hopsOf(previous, standings).slice(0, MOST_AT_ONCE);
    const launched = hops.flatMap((hop, index): Flight[] => {
      const start = startOf(hop);
      const end = landingOf(hop);
      if (start === null || end === null) return [];
      flown += 1;
      return [
        {
          key: `${hop.threadId}:${flown}`,
          threadId: hop.threadId,
          from: start,
          to: centre(end.getBoundingClientRect()),
          toStage: hop.to,
          delay: index * STAGGER_MS,
        },
      ];
    });
    if (launched.length > 0) setFlights((current) => [...current, ...launched]);
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
  const landed = useEffectEvent(props.onLanded);

  // oxlint-disable-next-line t3code/react-effect-budget -- Run the hop animation from measured rects, hiding its landing place until it lands; cancel on unmount.
  useLayoutEffect(() => {
    const sprite = element.current;
    if (sprite === null) return;
    const box = sprite.getBoundingClientRect();
    const x0 = flight.from.x - box.width / 2;
    const y0 = flight.from.y - box.height / 2;
    const x1 = flight.to.x - box.width / 2;
    const y1 = flight.to.y - box.height / 2;
    // Its place in the new row waits empty until it lands there.
    const place = inColumn(
      `[data-cells-stage="${flight.toStage}"] [data-cells-mini="${CSS.escape(flight.threadId)}"]`,
    );
    place?.style.setProperty("visibility", "hidden");
    const peak = Math.min(y0, y1) - RISE_PX;
    const at = (x: number, y: number, scale = 1) => ({
      transform: `translate(${x}px, ${y}px) scale(${scale})`,
    });
    const { duration } = motionTiming("travel");
    const hop = sprite.animate(
      [
        { ...at(x0, y0), opacity: 0 },
        { ...at(x0, y0), opacity: 1, offset: 0.1 },
        { ...at((x0 + x1) / 2, peak, 1.15), offset: 0.5 },
        at(x1, y1),
      ],
      { duration, delay: flight.delay, easing: "cubic-bezier(0.42, 0, 0.58, 1)", fill: "both" },
    );
    let live = true;
    void hop.finished.then(
      () => {
        if (!live) return;
        place?.style.removeProperty("visibility");
        bump(flight.toStage);
        landed();
      },
      () => undefined,
    );
    return () => {
      live = false;
      place?.style.removeProperty("visibility");
      hop.cancel();
    };
  }, [flight]);

  return (
    <span ref={element} data-cells-hop="" aria-hidden>
      <CellMini environmentId={props.environmentId} threadId={flight.threadId} />
    </span>
  );
}

/** The stage's count takes the Cell in: one bump. */
function bump(stage: Hop["to"]) {
  const count = inColumn(`[data-cells-stage="${stage}"] [data-cells-stage-count]`);
  if (count === null) return;
  const { duration, easing } = motionTiming("settle");
  count.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }],
    { duration, easing },
  );
}
