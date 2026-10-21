/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// The stage at a Cell's right where its buds stand while its Subcells work
// (`buds.ts`): a box the size of the Cell's, just past it, on the Cell's
// clock. Each bud is its Subcell as the transcript draws it (`SubcellMark`),
// dealt by its thread id, with its status for a face, at half the Cell's
// size and with no dot. The stage takes no room, so the Cell's own box
// still centres the Cell. Its parent places it: positioned, with the Cell's
// box at its start.

import { memo, useLayoutEffect, useRef, useState } from "react";

import { type Bud, type BudPlace, BudRow } from "./buds.ts";
import { onStage } from "./clock.ts";
import { BOX } from "./look.ts";
import { SubcellMark } from "./SubcellMark.tsx";
import "./cell.css";

/** A bud's figure, drawn again only when its Subcell changes, not as it moves. */
const BudFigure = memo(SubcellMark);

const same = (a: readonly BudPlace[], b: readonly BudPlace[]) =>
  a.length === b.length &&
  a.every(
    (place, i) =>
      place.bud.name === b[i]!.bud.name &&
      place.bud.status === b[i]!.bud.status &&
      place.bud.provider === b[i]!.bud.provider &&
      place.x === b[i]!.x &&
      place.lift === b[i]!.lift,
  );

export function CellBuds(props: {
  /** The Cell's Subcells, at work or done (`useCellBuds`); a bud stands for each at work, two at most. */
  readonly subcells: readonly Bud[];
  /** The Cell's provider, whose colours a bud wears when its Subcell names none. */
  readonly provider?: string | null | undefined;
  /** Points a cell is drawn, the Cell's own. */
  readonly points: number;
}) {
  const { subcells, points } = props;
  const [row] = useState(() => new BudRow());
  const [places, setPlaces] = useState<readonly BudPlace[]>([]);
  const stage = useRef<HTMLSpanElement>(null);
  // The Subcells as text: the stage looks again when one of them changes, not as each item streams in.
  const heard = JSON.stringify(subcells);
  useLayoutEffect(() => {
    const element = stage.current;
    if (element === null) return;
    const told = JSON.parse(heard) as Bud[];
    return onStage(element, (seconds) => {
      const next = row.at(told, seconds);
      setPlaces((was) => (same(was, next) ? was : next));
    });
  }, [row, heard]);
  const unit = points / 2;
  return (
    <span
      ref={stage}
      className="cell-buds"
      style={{
        width: BOX.width * points,
        height: BOX.height * points,
        insetInlineStart: BOX.width * points,
        insetBlockEnd: 0,
      }}
      aria-hidden="true"
    >
      {places.map(({ bud, x, lift }, depth) => (
        <span
          key={bud.name}
          className="cell-bud"
          style={{ insetInlineStart: x * unit, insetBlockEnd: lift * unit, zIndex: depth }}
        >
          <BudFigure
            name={bud.name}
            provider={bud.provider ?? props.provider}
            status={bud.status}
            points={unit}
          />
        </span>
      ))}
    </span>
  );
}
