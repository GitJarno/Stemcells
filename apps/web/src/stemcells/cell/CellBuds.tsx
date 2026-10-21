/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// The stage at a Cell's right where its buds stand while its subagents work
// (`buds.ts`): a box the size of the Cell's, just past it, painted in the
// Cell's colours on the Cell's clock, with the same margin past its box
// (`MARGIN`). It takes no room, so the Cell's own box still centres the
// Cell. Its parent places it: positioned, with the Cell's box at its start.

import { useLayoutEffect, useRef, useState } from "react";

import { BudRow } from "./buds.ts";
import { bodyOf } from "./cast.ts";
import { onStage } from "./clock.ts";
import type { Ground } from "./keyline.ts";
import { BOX } from "./look.ts";
import { paint } from "./paint.ts";
import { MARGIN, type MiniFrame, packLook, sceneOf } from "./scene.ts";
import "./cell.css";

const clear = (width: number, height: number) =>
  Array.from({ length: height }, () => ".".repeat(width));

/** The stage with no bud on it. */
const EMPTY: MiniFrame = {
  rows: clear(BOX.width, BOX.height),
  detail: clear(BOX.width * 2, BOX.height * 2),
  drawn: {
    rows: clear(BOX.width + MARGIN.x * 2, BOX.height + MARGIN.y * 2),
    detail: clear((BOX.width + MARGIN.x * 2) * 2, (BOX.height + MARGIN.y * 2) * 2),
  },
};

/** Buds wear nothing: the Cell's body, small. */
const BARE = packLook([]);

export function CellBuds(props: {
  /** Buds wanted: the subagents at work (`budsOf`). */
  readonly count: number;
  /** The Cell's provider, whose colours the buds wear. */
  readonly provider?: string | null | undefined;
  readonly ground: Ground;
  /** Points a cell is drawn, the Cell's own. */
  readonly points: number;
}) {
  const { count, ground, points } = props;
  const body = bodyOf(props.provider);
  const [row] = useState(() => new BudRow((key) => sceneOf(BARE, key)));
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null) return;
    let shown: { frame: MiniFrame; dpr: number } | undefined;
    return onStage(element, (seconds) => {
      const frame = row.at(count, seconds) ?? EMPTY;
      const dpr = devicePixelRatio || 1;
      if (shown?.frame === frame && shown.dpr === dpr) return;
      shown = { frame, dpr };
      paint(element, frame, body, points, dpr, ground);
    });
  }, [row, count, body, points, ground]);
  return (
    <canvas
      ref={canvas}
      className="character cell-buds"
      style={{
        width: (BOX.width + MARGIN.x * 2) * points,
        height: (BOX.height + MARGIN.y * 2) * points,
        insetInlineStart: (BOX.width - MARGIN.x) * points,
        insetBlockEnd: -MARGIN.y * points,
      }}
      aria-hidden="true"
    />
  );
}
