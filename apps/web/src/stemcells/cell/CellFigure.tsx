/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// A Cell's character: the original app's Cell, drawn from the kit frame by
// frame in its provider's colours, wearing what it was dealt, playing what
// its mood and its work call for, with the "?" over it while it waits on
// you. Its box is the miniature's (13 × 14 cells), hats and all, so every
// Cell stands on the same line.

import { useLayoutEffect, useRef, useState } from "react";
import type { Activity } from "./activity.ts";
import { AskMark } from "./AskMark.tsx";
import { bodyOf, frameShown, sceneFor } from "./cast.ts";
import { onStage } from "./clock.ts";
import { BOX, moodOf, POINTS_PER_PIXEL } from "./look.ts";
import { dayOf, looksOf } from "./looks.ts";
import { paint } from "./paint.ts";
import { type MiniFrame, packLook } from "./scene.ts";
import "../tokens/stemcells.css";
import "./cell.css";

/** What a Cell named `name` wears on `day` when dealt alone: its own first piece of each theme worn. */
export function lookOf(name: string, day: string): readonly string[] {
  return looksOf([name], day).get(name)?.worn ?? [];
}

/**
 * A Cell's character in its mood. It wears `look` (`theme/piece` ids, dealt
 * over the whole roster so no two wear one piece) when given; otherwise the
 * look its name is dealt alone, on the day it was first drawn, kept while it
 * stays on screen. Its name also picks when it blinks.
 */
export function CellFigure(props: {
  readonly name: string;
  readonly mood: string;
  readonly activity?: Activity | undefined;
  /** Its provider (`claudeAgent`, `codex`, …), whose colours it wears; absent, the coral Cell's. */
  readonly provider?: string | null | undefined;
  readonly look?: readonly string[] | undefined;
  /** CSS pixels a cell of the miniature is drawn; 1 or 2 draw the hero art on a 2× display. */
  readonly points?: number | undefined;
}) {
  const { name, activity } = props;
  const [day] = useState(() => dayOf(new Date()));
  const mood = moodOf(props.mood);
  const worn = (props.look ?? lookOf(name, day)).join("+");
  const body = bodyOf(props.provider);
  const points = props.points ?? POINTS_PER_PIXEL;
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null) return;
    const look = packLook(worn.split("+"));
    let shown: { frame: MiniFrame; dpr: number } | undefined;
    return onStage(element, (seconds) => {
      const scene = sceneFor(look, mood, activity, seconds ?? 0);
      const frame = frameShown(scene, name, seconds, mood === "needsYou");
      const dpr = devicePixelRatio || 1;
      if (shown?.frame === frame && shown.dpr === dpr) return;
      shown = { frame, dpr };
      paint(element, frame, body, points, dpr);
    });
  }, [worn, mood, activity, name, body, points]);
  return (
    <span className="cell-figure" data-mood={mood} data-activity={activity}>
      <canvas
        ref={canvas}
        className="character"
        style={{ width: BOX.width * points, height: BOX.height * points }}
        aria-hidden="true"
      />
      <AskMark active={mood === "needsYou"} pixel={points} />
    </span>
  );
}
