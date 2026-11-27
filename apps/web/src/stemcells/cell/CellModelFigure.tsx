/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (cell.css), outside upstream's Tailwind entry. */
// A Cell drawn from its model (`model/`), in the box and on the line `CellFigure` keeps. Its
// pose is stepped twelve times a second, and a picture is taken only when it has moved half
// a pixel, so a Cell at rest costs a picture now and then.

import { useLayoutEffect, useRef } from "react";

import type { Activity } from "./activity.ts";
import { onStage } from "./clock.ts";
import type { Strength } from "./kit.ts";
import { BOX, moodOf, POINTS_PER_PIXEL } from "./look.ts";
import { type Act, moved, performerOf, poseAt, STILL } from "./model/acts.ts";
import { figureOf, type Pose } from "./model/body.ts";
import { drawSprite, tallerView, wholeView } from "./model/sprite.ts";
import { actOf, grownOf, hueOf, seedOf } from "./model/stance.ts";
import { roomOver, wear, wornLayers } from "./model/worn.ts";
import { bodyOf } from "./cast.ts";
import { MARGIN } from "./scene.ts";
import "../tokens/stemcells.css";
import "./cell.css";

/** The tallest picture drawn: past it, a picture's pixel takes several of the display's. */
const ROWS = 64;

export function CellModelFigure(props: {
  readonly name: string;
  readonly mood: string;
  readonly activity?: Activity | undefined;
  readonly provider?: string | null | undefined;
  readonly points?: number | undefined;
  readonly strength?: Strength | undefined;
  /** What it wears, as the drawn Cell does (`looks.ts`): the same pieces, on this body. */
  readonly look?: readonly string[] | undefined;
}) {
  const { name, provider } = props;
  const mood = moodOf(props.mood);
  const act = actOf(mood, props.activity);
  const grown = grownOf(props.strength);
  const points = props.points ?? POINTS_PER_PIXEL;
  const look = (props.look ?? []).join("+");
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
    const layers = wornLayers(look === "" ? [] : look.split("+"));
    let last: number | undefined;
    let shown: { readonly pose: Pose; readonly rows: number } | undefined;
    return onStage(element, (seconds) => {
      const dpr = devicePixelRatio || 1;
      const tall = Math.round((BOX.height + MARGIN.y * 2) * points * dpr);
      const wide = Math.round((BOX.width + MARGIN.x * 2) * points * dpr);
      const coarse = Math.ceil(tall / ROWS);
      const whole = wholeView(grown, Math.round(tall / coarse), 0.45, Math.round(wide / coarse));
      // Headwear takes room over the box: the picture is that much taller, and stands over it.
      const over = roomOver(figureOf(poseAt("rest", STILL.rest, grown)), whole, layers);
      const view = over === 0 ? whole : tallerView(whole, over);
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
      const figure = figureOf(pose);
      const sprite = wear(drawSprite(figure, view, hue), figure, view, layers, bodyOf(provider));
      if (element.width !== sprite.width) element.width = sprite.width;
      if (element.height !== sprite.height) element.height = sprite.height;
      const row = ((BOX.height + MARGIN.y * 2) * points) / whole.rows;
      element.style.height = `${view.rows * row}px`;
      element.style.insetBlockStart = `${-MARGIN.y * points - over * row}px`;
      element
        .getContext("2d")
        ?.putImageData(new ImageData(sprite.pixels, sprite.width, sprite.height), 0, 0);
    });
  }, [name, grown, act, provider, points, look]);
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
          insetInlineStart: -MARGIN.x * points,
        }}
        aria-hidden="true"
      />
    </span>
  );
}
