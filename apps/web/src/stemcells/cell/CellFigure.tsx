/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// A Cell's character: the original app's Cell, drawn from the kit frame by
// frame in its provider's colours, wearing what it was dealt, playing what
// its mood and its work call for, with the "?" over it while it waits on
// you. Its box is the miniature's (13 × 14 cells), hats and all, so every
// Cell stands on the same line. Its picture reaches past the box by a
// margin (`MARGIN`), where the original's widest pieces go, taking no room.

import { useLayoutEffect, useRef, useState } from "react";
import type { Activity } from "./activity.ts";
import { AskMark } from "./AskMark.tsx";
import { clockSeconds } from "./blink.ts";
import { bodyOf, frameShown, sceneFor } from "./cast.ts";
import { onStage } from "./clock.ts";
import { BLOCKS, empty, type Forming, formingPart, HOP, inBlocks } from "./forming.ts";
import type { Ground } from "./keyline.ts";
import type { Strength } from "./kit.ts";
import { asksYou, BOX, moodOf, POINTS_PER_PIXEL } from "./look.ts";
import { dayOf, looksOf } from "./looks.ts";
import { type Diff, withMarks } from "./marks.ts";
import { paint } from "./paint.ts";
import { BEAT, type CellLook, grown, MARGIN, type MiniFrame, sceneOf, wornLook } from "./scene.ts";
import "../tokens/stemcells.css";
import "./cell.css";

/** What a Cell named `name` wears on `day` when dealt alone: its own first item of each theme worn. */
export function lookOf(name: string, day: string): readonly string[] {
  return looksOf([name], day).get(name)?.worn ?? [];
}

/** The frames a Cell in `look` forms through: its box empty, its blocks, its hop; none when the kit has no hop. */
function formedOf(look: CellLook) {
  const hop = sceneOf(look, HOP)?.mini;
  const first = hop?.[0];
  if (hop === undefined || first === undefined) return undefined;
  const blocks = Array.from({ length: BLOCKS }, (_, step) => inBlocks(first, step));
  return { before: empty(first), blocks, hop };
}

/**
 * A Cell's character in its mood. It wears `look` (ids `looks.ts` deals over
 * the crew in view, so no two look alike) when given; otherwise the
 * look its name is dealt alone, on the day it was first drawn, kept while it
 * stays on screen. Its name also picks when it blinks. Grown strong, it holds
 * its arms at rest; a landing that earned it flexes. As its cheer starts, a
 * + and a − rise for the lines its run added and removed, and are gone.
 * Asked to form as it starts, it condenses on its line from blocks, then
 * hops onto it (`forming.ts`).
 */
export function CellFigure(props: {
  readonly name: string;
  readonly mood: string;
  readonly activity?: Activity | undefined;
  /** Its provider (`claudeAgent`, `codex`, …), whose colours it wears; absent, the coral Cell's. */
  readonly provider?: string | null | undefined;
  readonly look?: readonly string[] | undefined;
  /** The frame behind it: on the light one its pale pieces are keylined (`keyline.ts`); black unless told. */
  readonly ground?: Ground | undefined;
  /** CSS pixels a cell of the miniature is drawn; 1 or 2 draw the hero art on a 2× display. */
  readonly points?: number | undefined;
  /** How strong it has grown from working alone (`growth.ts`); bare unless told. */
  readonly strength?: Strength | undefined;
  /** Its landing earned the flex, which it plays in place of its cheer. */
  readonly flexes?: boolean | undefined;
  /** What its landing's run did to the lines of its files (`marks.ts`). */
  readonly diff?: Diff | undefined;
  /** When it landed (ms since the epoch): the marks rise once a landing. */
  readonly landedAt?: number | null | undefined;
  /** Its forming as it starts (`forming.ts`): its box empty until the hand-off, then its blocks and its hop. */
  readonly forming?: Forming | undefined;
}) {
  const { name, activity, strength } = props;
  const flexes = props.flexes ?? false;
  const added = props.diff?.added ?? false;
  const removed = props.diff?.removed ?? false;
  const landedAt = props.landedAt ?? null;
  const formsAt = props.forming?.at;
  const [day] = useState(() => dayOf(new Date()));
  const mood = moodOf(props.mood);
  const worn = (props.look ?? lookOf(name, day)).join("+");
  const body = bodyOf(props.provider);
  const points = props.points ?? POINTS_PER_PIXEL;
  const ground = props.ground ?? "black";
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The landing whose marks it has raised, and from when (`clockSeconds`). */
  const rising = useRef<{ landing: number; from: number } | null>(null);
  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null) return;
    const look = grown(wornLook(worn.split("+")), strength, flexes);
    // The marks rise over the cheer only, once, from when the figure first
    // draws them: the landing's diff is read a moment after the landing.
    const landing = mood === "pleased" && (added || removed) ? landedAt : null;
    if (landing !== null && rising.current?.landing !== landing)
      rising.current = { landing, from: clockSeconds() };
    const from = landing === null ? undefined : rising.current?.from;
    const formed = formsAt === undefined ? undefined : formedOf(look);
    let shown: { frame: MiniFrame; dpr: number } | undefined;
    return onStage(element, (seconds) => {
      const part =
        formed === undefined || formsAt === undefined || seconds === undefined
          ? undefined
          : formingPart(Math.floor((seconds - formsAt) * BEAT), formed.hop.length);
      const scene = sceneFor(look, mood, activity, seconds ?? 0);
      const played =
        part === undefined || formed === undefined
          ? frameShown(scene, name, seconds, asksYou(mood))
          : part.part === "empty"
            ? formed.before
            : part.part === "blocks"
              ? formed.blocks[part.step]!
              : formed.hop[part.step]!;
      const frame =
        from === undefined || part !== undefined
          ? played
          : withMarks(
              played,
              { added, removed },
              seconds === undefined ? undefined : Math.trunc((seconds - from) * BEAT),
            );
      const dpr = devicePixelRatio || 1;
      if (shown?.frame === frame && shown.dpr === dpr) return;
      shown = { frame, dpr };
      paint(element, frame, body, points, dpr, ground);
    });
  }, [
    worn,
    strength,
    flexes,
    added,
    removed,
    landedAt,
    formsAt,
    mood,
    activity,
    name,
    body,
    points,
    ground,
  ]);
  return (
    <span
      className="cell-figure"
      data-mood={mood}
      data-activity={activity}
      data-strength={strength}
      data-marks={added || removed ? `${added ? "+" : ""}${removed ? "−" : ""}` : undefined}
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
      <AskMark active={asksYou(mood)} pixel={points} />
    </span>
  );
}
