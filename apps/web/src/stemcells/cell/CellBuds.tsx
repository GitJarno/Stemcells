/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// The stage at a Cell's right where its buds stand while its subagents work
// (`buds.ts`): a box the size of the Cell's, just past it, painted in the
// Cell's colours on the Cell's clock. It takes no room, so the Cell's own
// box still centres the Cell. Its parent places it: positioned, with the
// Cell's box at its start.

import { useLayoutEffect, useRef, useState } from "react";

import { BudRow } from "./buds.ts";
import { bodyOf } from "./cast.ts";
import { onStage } from "./clock.ts";
import type { Ground } from "./keyline.ts";
import { BOX } from "./look.ts";
import { paint } from "./paint.ts";
import { type MiniFrame, packLook, sceneOf } from "./scene.ts";
import "./cell.css";

/** The stage with no bud on it. */
const EMPTY: MiniFrame = {
  rows: Array.from({ length: BOX.height }, () => ".".repeat(BOX.width)),
  detail: Array.from({ length: BOX.height * 2 }, () => ".".repeat(BOX.width * 2)),
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
        width: BOX.width * points,
        height: BOX.height * points,
        insetInlineStart: BOX.width * points,
      }}
      aria-hidden="true"
    />
  );
}
