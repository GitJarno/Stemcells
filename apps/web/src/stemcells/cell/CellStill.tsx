/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// A Cell held still: its picture at rest in `look`, painted once, with no
// clock. For a page of many Cells (Settings › Lineage), where none of them
// is at work and a breath each would cost a frame a Cell.

import { useLayoutEffect, useRef } from "react";

import { bodyOf, frameShown, sceneFor } from "./cast.ts";
import type { Ground } from "./keyline.ts";
import { BOX } from "./look.ts";
import { paint } from "./paint.ts";
import { MARGIN, wornLook } from "./scene.ts";
import "./cell.css";

export function CellStill(props: {
  readonly name: string;
  readonly look: readonly string[];
  readonly provider: string | null;
  readonly points: number;
  readonly ground: Ground;
}) {
  const { name, provider, points, ground } = props;
  const worn = props.look.join("+");
  const canvas = useRef<HTMLCanvasElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Paint the still frame onto its canvas before the browser paints, whenever what it shows changes.
  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null) return;
    const scene = sceneFor(wornLook(worn === "" ? [] : worn.split("+")), "awake", undefined, 0);
    paint(
      element,
      frameShown(scene, name, undefined, false),
      bodyOf(provider),
      points,
      devicePixelRatio || 1,
      ground,
    );
  }, [worn, name, provider, points, ground]);
  return (
    <span
      className="cell-figure"
      style={{ width: BOX.width * points, height: BOX.height * points }}
    >
      <canvas
        ref={canvas}
        className="character"
        style={{
          width: (BOX.width + MARGIN.x * 2) * points,
          height: (BOX.height + MARGIN.y * 2) * points,
          insetInlineStart: -MARGIN.x * points,
          insetBlockStart: -MARGIN.y * points,
        }}
        aria-hidden="true"
      />
    </span>
  );
}
