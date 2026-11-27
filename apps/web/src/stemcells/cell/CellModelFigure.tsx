/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// A Cell drawn from its model (`model/`), in the box and on the line `CellFigure` keeps. Its
// pose is stepped twelve times a second, and a picture is taken only when it has moved half
// a pixel, so a Cell at rest costs a picture now and then.

import { useLayoutEffect, useRef } from "react";

import type { Activity } from "./activity.ts";
import { onStage } from "./clock.ts";
import type { Strength } from "./kit.ts";
import { BOX, moodOf, POINTS_PER_PIXEL } from "./look.ts";
import { type Act, moved, performerOf, poseAt } from "./model/acts.ts";
import { figureOf, type Pose } from "./model/body.ts";
import { drawSprite, wholeView } from "./model/sprite.ts";
import { actOf, grownOf, hueOf } from "./model/stance.ts";
import { MARGIN } from "./scene.ts";
import "../tokens/stemcells.css";
import "./cell.css";

/** The tallest picture drawn: past it, a picture's pixel takes several of the display's. */
const ROWS = 64;

/** Where each act stands still under Reduce Motion: ms into it, at its telling pose. */
const STILL: Readonly<Record<Act, number>> = {
  rest: 0,
  thinking: 3000,
  writing: 2500,
  watching: 2500,
  asking: 300,
  landed: 2700,
  asleep: 1000,
};

/** A number in 0 to 1 a name always gives: when its Cell breathes and blinks. */
const seedOf = (name: string) =>
  [...name].reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) % 9973, 7) / 9973;

export function CellModelFigure(props: {
  readonly name: string;
  readonly mood: string;
  readonly activity?: Activity | undefined;
  readonly provider?: string | null | undefined;
  readonly points?: number | undefined;
  readonly strength?: Strength | undefined;
}) {
  const { name, provider } = props;
  const mood = moodOf(props.mood);
  const act = actOf(mood, props.activity);
  const grown = grownOf(props.strength);
  const points = props.points ?? POINTS_PER_PIXEL;
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The body playing, kept while it is the same Cell at the same growth, and the act it was last given. */
  const playing = useRef<{
    readonly of: string;
    readonly performer: ReturnType<typeof performerOf>;
    act: Act | undefined;
  }>(undefined);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Draw the model on the canvas on each stage clock tick, unsubscribing when what it plays changes.
  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null) return;
    const of = `${name}\n${grown}`;
    if (playing.current?.of !== of)
      playing.current = { of, performer: performerOf(grown, seedOf(name)), act: undefined };
    const body = playing.current;
    const hue = hueOf(provider);
    let last: number | undefined;
    let shown: { readonly pose: Pose; readonly rows: number } | undefined;
    return onStage(element, (seconds) => {
      const dpr = devicePixelRatio || 1;
      const tall = Math.round((BOX.height + MARGIN.y * 2) * points * dpr);
      const wide = Math.round((BOX.width + MARGIN.x * 2) * points * dpr);
      const coarse = Math.ceil(tall / ROWS);
      const view = wholeView(grown, Math.round(tall / coarse), 0.45, Math.round(wide / coarse));
      let pose: Pose;
      if (seconds === undefined) {
        pose = poseAt(act, STILL[act], grown);
      } else {
        const now = seconds * 1000;
        if (body.act !== act) {
          body.performer.play(act, now);
          body.act = act;
        }
        pose = body.performer.step(
          now,
          last === undefined ? 1 / 12 : Math.min(0.25, (now - last) / 1000),
        );
        last = now;
      }
      if (shown?.rows === view.rows && !moved(shown.pose, pose, view.span / view.rows)) return;
      shown = { pose, rows: view.rows };
      const sprite = drawSprite(figureOf(pose), view, hue);
      if (element.width !== sprite.width) element.width = sprite.width;
      if (element.height !== sprite.height) element.height = sprite.height;
      element
        .getContext("2d")
        ?.putImageData(new ImageData(sprite.pixels, sprite.width, sprite.height), 0, 0);
    });
  }, [name, grown, act, provider, points]);
  return (
    <span
      className="cell-figure"
      data-mood={mood}
      data-act={act}
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
