// 03 · It becomes what you need. A Cell stands on the app's window and grows
// with the time it works alone, at the app's own marks (`cell/growth.ts`).
// Under it the window takes the shape of the work: one chat, two side by
// side, a crew in tabs and panes, a Cell on the ledge for each.

import {
  type CellLook,
  grown,
  type MiniFrame,
  sceneOf,
  type Strength,
  tossFrame,
} from "./app-cells.ts";
import { type Cell, crew, drawCell, frameAt } from "./cells.ts";
import { between, Exhibit } from "./kit/exhibit.ts";
import { density, ease, lerp, span } from "./kit/form.ts";
import { layerIn, scene } from "./kit/scenes.ts";
import { VIEW } from "./shots.ts";

const CREW = [
  ["Otter", "claude"],
  ["Waffle", "codex"],
  ["Pickle", "gemini"],
  ["Kiwi", "kimi"],
] as const;
/** What each of the crew is doing on the ledge. */
const WORK = ["busy/0", "reading/0", "searching/0", "testing/0"] as const;

/** A strength: when in the story it is worn, and the minutes alone that grew it. */
const TIERS: readonly { at: number; strength: Strength | undefined; minutes: number }[] = [
  { at: 0, strength: undefined, minutes: 3 },
  { at: 0.12, strength: "nubs", minutes: 10 },
  { at: 0.24, strength: "arms", minutes: 30 },
  { at: 0.36, strength: "biceps", minutes: 120 },
];
/** When the window turns to its next shape, and when each of the crew drops onto the ledge. */
const TURNS = [0.5, 0.74] as const;
const JOINS = [0, 0.5, 0.74, 0.78] as const;
const BEATS = [
  [0, "A Cell starts plain."],
  [0.12, "Ten minutes on its own: nubs."],
  [0.24, "Thirty: arms."],
  [0.36, "Two hours. Look at those arms."],
  [0.5, "Two chats, side by side."],
  [0.74, "A whole crew, in tabs and panes."],
] as const;
/** How much of the story a new strength's bounce takes; the bounce is a landing at this speed over this long. */
const BOUNCE = 0.03,
  HIT = 300,
  BOUNCE_MS = 600;
const FONT =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const STILL = 0.9;

const alone = (minutes: number): string =>
  minutes < 60
    ? `${Math.round(minutes)} min`
    : `${(minutes / 60).toFixed(minutes < 120 ? 1 : 0)} h`;

export function becomes(root: HTMLElement): void {
  const pin = root.querySelector<HTMLElement>(".pin")!;
  const cells = layerIn(root, "cells");
  const context = cells.getContext("2d")!;
  const beat = root.querySelector<HTMLElement>(".beat")!;
  const app = new Exhibit(root.querySelector<HTMLElement>(".window")!, [
    "shape-one",
    "shape-two",
    "shape-four",
  ]);
  // One deal for the whole scene, so the Cell that grew is the Cell that leads the crew.
  const cast: Cell[] = crew(CREW);
  const otter = cast[0]!;
  const grownTo = (look: CellLook): Cell => ({ ...otter, look });
  const tiers = TIERS.map(({ strength }) =>
    grownTo(grown(otter.look, strength, strength === "biceps")),
  );
  let saying = "";

  /** A Cell as it lands: the app's own springs, read off the story. */
  const landing = (look: CellLook, since: number, points: number): MiniFrame =>
    tossFrame(
      look,
      {
        held: false,
        vx: 0,
        vy: 0,
        grounded: true,
        hits: [{ surface: "floor", speed: HIT, at: 0 }],
      },
      since * BOUNCE_MS,
      points,
    );

  scene(
    root,
    (f) => {
      const d = density();
      const { p } = f;
      if (cells.width !== Math.round(f.width * d) || cells.height !== Math.round(f.height * d)) {
        cells.width = Math.round(f.width * d);
        cells.height = Math.round(f.height * d);
        cells.style.width = `${f.width}px`;
        cells.style.height = `${f.height}px`;
      }
      app.turn(TURNS.reduce((sum, at) => sum + span(p, at, at + 0.016), 0));
      // Close on the one fresh Cell while it grows, then back for the whole window as it fills.
      app.look(
        between(VIEW.fresh, VIEW.whole, ease.inOut(span(p, TURNS[0] - 0.1, TURNS[0] - 0.01))),
      );

      // The ledge: the window's top edge, read each frame since a longer line under it moves the window.
      const frame = app.frame.getBoundingClientRect(),
        box = pin.getBoundingClientRect();
      const left = frame.left - box.left,
        right = frame.right - box.left,
        top = frame.top - box.top;
      const scale = f.form === "phone" ? 2 : 3;
      const crowd = JOINS.filter((at) => p >= at).length;
      const spread = ease.inOut(span(p, TURNS[0], TURNS[0] + 0.06)),
        wide = ease.inOut(span(p, TURNS[1], TURNS[1] + 0.06));
      /** Where the nth stands: alone in the middle, then in line across the window. */
      const seat = (n: number): number => {
        const two = lerp(0.5, n === 0 ? 0.28 : 0.72, spread);
        const four = (n + 0.5) / CREW.length;
        return lerp(left, right, lerp(two, four, wide));
      };

      context.clearRect(0, 0, cells.width, cells.height);
      const n = TIERS.findLastIndex((tier) => p >= tier.at);
      const tier = TIERS[n]!,
        next = TIERS[n + 1];
      const since = (p - tier.at) / BOUNCE;
      const lead = tiers[n]!;
      const flex = sceneOf(tiers[3]!.look, "happy")!.mini;
      const leadFrame =
        n > 0 && since < 1
          ? landing(lead.look, since, scale * 2)
          : n === 3 && p < TURNS[0]
            ? flex[5 + Math.min(5, Math.floor(f.t * 12) % 18)]!
            : frameAt(lead, WORK[0], f.t);
      for (let who = 0; who < crowd; who++) {
        const cell = who === 0 ? lead : cast[who]!;
        const dropped = (p - JOINS[who]!) / BOUNCE;
        const frame =
          who === 0
            ? leadFrame
            : dropped < 1
              ? landing(cell.look, dropped, scale * 2)
              : frameAt(cell, WORK[who]!, f.t + who * 0.7);
        drawCell(context, cell, frame, {
          x: seat(who) * d,
          y: (top - 1) * d,
          px: scale * d,
          alpha: who === 0 ? 1 : ease.out(span(dropped, 0, 0.4)),
        });
      }

      // The time it has flown alone, over its head: what grows it.
      const filling = next === undefined ? 1 : span(p, tier.at, next.at);
      const minutes = lerp(tier.minutes, next?.minutes ?? tier.minutes, filling);
      const fade = 1 - span(p, TURNS[0] - 0.04, TURNS[0]);
      if (fade > 0) {
        const size = f.form === "phone" ? 11 : 12;
        context.font = `500 ${size * d}px ${FONT}`;
        context.textAlign = "center";
        context.textBaseline = "alphabetic";
        context.globalAlpha = fade;
        context.fillStyle = "rgba(237, 233, 224, 0.42)";
        const base = (top - 34 * scale) * d;
        context.fillText("on its own", seat(0) * d, base - (size + 5) * d);
        context.fillStyle = "rgba(237, 233, 224, 0.9)";
        context.fillText(alone(minutes), seat(0) * d, base);
        context.globalAlpha = 1;
      }

      const line = BEATS.findLast(([at]) => p >= at)![1];
      if (line !== saying) {
        saying = line;
        beat.textContent = line;
      }
    },
    { still: STILL },
  );
}
