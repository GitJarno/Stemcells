/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// A thrown Cell in flight: the live figure in what it wears, drawn every
// frame from the carry engine's facts (`toss.ts`), its dizzy stars behind
// it. The engine moves the box and runs the frame; this draws what is in it.

import { useLayoutEffect, useRef, useState } from "react";
import { reducedMotion, timing } from "../tokens/motion.ts";
import { bodyOf } from "./cast.ts";
import { lookOf } from "./CellFigure.tsx";
import type { Ground } from "./keyline.ts";
import { paletteOf, type Strength } from "./kit.ts";
import { BOX, POINTS_PER_PIXEL } from "./look.ts";
import { dayOf } from "./looks.ts";
import { paint } from "./paint.ts";
import { grown, MARGIN, type MiniFrame, wornLook } from "./scene.ts";
import { dizzyStars, type Star, type Toss, tossFrame } from "./toss.ts";
import "../tokens/stemcells.css";
import "./cell.css";

/** How far the stars reach past the box's centre, in boxes: round the head, and their size. */
const SKY = { x: 0.6 + 0.25, y: 0.56 + 0.25 } as const;

/** The stars at `stars`, on `canvas` (`width` × `height` CSS px, centred on the box), in the Cell's star and sparkle inks. */
function drawStars(
  canvas: HTMLCanvasElement,
  size: { readonly width: number; readonly height: number },
  stars: readonly Star[],
  inks: Readonly<Record<string, string>>,
  dpr: number,
): void {
  const width = Math.round(size.width * dpr);
  const height = Math.round(size.height * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.setTransform(dpr, 0, 0, dpr, width / 2, height / 2);
  for (const star of stars) {
    context.globalAlpha = star.alpha;
    context.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 - Math.PI / 2;
      const reach = k % 2 === 0 ? star.r : star.r * 0.38;
      context.lineTo(star.x + Math.cos(a) * reach, star.y + Math.sin(a) * reach);
    }
    context.closePath();
    context.fillStyle = inks.Y ?? "";
    context.fill();
    context.fillStyle = inks.W ?? "";
    context.fillRect(star.x - 0.6, star.y - 0.6, 1.2, 1.2);
  }
  context.globalAlpha = 1;
}

/** Draws a thrown Cell for one frame, from the flight's facts then. */
export type TossDraw = (toss: Toss, now: number) => void;

/**
 * A thrown Cell, in its box at its size on the line: its pose each time its flight is stepped
 * (`frames`, `toss.ts`), with three stars round its head while dizzy. Its look, colours and
 * frame behind it as `CellFigure` takes them. Under Reduce Motion its body holds still.
 */
export function CellToss(props: {
  readonly name: string;
  readonly look?: readonly string[] | undefined;
  /** Its provider (`claudeAgent`, `codex`, …), whose colours it wears; absent, the coral Cell's. */
  readonly provider?: string | null | undefined;
  /** The frame behind it: on the light one its pale pieces are keylined (`keyline.ts`). */
  readonly ground?: Ground | undefined;
  /** CSS pixels a cell of the miniature is drawn; 1 or 2 draw the hero art on a 2× display. */
  readonly points?: number | undefined;
  readonly strength?: Strength | undefined;
  /**
   * Its flight's frames: `draw` is called each frame once the flight has
   * stepped, and at once with its facts now; the returned function stops it.
   * One loop, the flight's, runs the frame.
   */
  readonly frames: (draw: TossDraw) => () => void;
}) {
  const [day] = useState(() => dayOf(new Date()));
  const worn = (props.look ?? lookOf(props.name, day)).join("+");
  const body = bodyOf(props.provider);
  const points = props.points ?? POINTS_PER_PIXEL;
  const ground = props.ground ?? "black";
  const { strength } = props;
  const { frames } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const sky = useRef<HTMLCanvasElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Paint the thrown Cell and its stars on each flight frame, unsubscribing from `frames` on change.
  useLayoutEffect(() => {
    const cell = canvas.current;
    const stars = sky.current;
    if (cell === null || stars === null) return;
    const look = grown(wornLook(worn.split("+")), strength);
    const inks = paletteOf(body);
    const dizzy = timing("dizzy");
    const size = { width: 2 * SKY.x * BOX.width * points, height: 2 * SKY.y * BOX.height * points };
    let shown: { frame: MiniFrame; dpr: number } | undefined;
    let starry = false;
    const draw: TossDraw = (toss, now) => {
      const dpr = devicePixelRatio || 1;
      const picture = tossFrame(look, toss, now, points, reducedMotion());
      if (shown?.frame !== picture || shown.dpr !== dpr) {
        shown = { frame: picture, dpr };
        paint(cell, picture, body, points, dpr, ground);
      }
      const t = toss.dizzyFrom === undefined ? undefined : now - toss.dizzyFrom;
      if (t === undefined && !starry) return;
      drawStars(stars, size, t === undefined ? [] : dizzyStars(t, dizzy, points), inks, dpr);
      starry = t !== undefined;
    };
    return frames(draw);
  }, [worn, strength, body, points, ground, frames]);
  const width = BOX.width * points;
  const height = BOX.height * points;
  return (
    <span className="cell-figure" style={{ width, height }}>
      {/* First, so the stars circle behind the Cell. */}
      <canvas
        ref={sky}
        className="cell-toss-stars"
        style={{
          width: 2 * SKY.x * width,
          height: 2 * SKY.y * height,
          insetInlineStart: width / 2 - SKY.x * width,
          insetBlockStart: height / 2 - SKY.y * height,
        }}
        aria-hidden="true"
      />
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
