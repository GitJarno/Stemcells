/**
 * The words' half of the spawn, as geometry and times
 * (`stemcells/docs/interaction.md`): the sent words leave the composer as
 * letters and pour into Aski; Aski sends one stream to each Cell's pane;
 * over the Cell's box the stream condenses into glyphs, and the Cell takes
 * over (`cell/forming.ts`). Pure: `play.ts` draws it.
 */

/** A point on screen, in viewport CSS pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A box on screen, in viewport CSS pixels (`getBoundingClientRect`). */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The most letters that leave: the rest of a long message goes with them unseen. */
export const MOST_LETTERS = 48;

/** The most streams in flight at once. */
export const MOST_IN_FLIGHT = 4;

/** The glyphs a stream condenses through over the Cell's box, one a `form-step`. */
export const GLYPHS = [".", ":", "+", "#", "@"] as const;

/**
 * Where Aski stands for a spawn: on the new chat's `headline`, as wide as
 * it and `tall` high, so the letters go round Aski over the composer.
 */
export function standing(headline: Box, tall: number): Box {
  return { x: headline.x, y: headline.y - tall, width: headline.width, height: tall };
}

/** How far apart the letters leave: the stagger, or less, so all of them leave within the span. */
export function letterStagger(count: number, stagger: number, span: number): number {
  return count <= 0 ? 0 : Math.min(stagger, span / count);
}

export const centreOf = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/**
 * Where letter `slot` of `count` rides the orbit round Aski in `box`,
 * `turns` turns on: evenly spaced on an ellipse as tall as the box and at
 * most as wide, from the top, clockwise on screen.
 */
export function orbitAt(box: Box, slot: number, count: number, turns: number): Point {
  const centre = centreOf(box);
  const angle = 2 * Math.PI * (slot / Math.max(1, count) + turns);
  const rx = Math.min(box.width / 2, box.height);
  const ry = box.height / 2;
  return { x: centre.x + rx * Math.sin(angle), y: centre.y - ry * Math.cos(angle) };
}

/**
 * `steps + 1` points along the way from `from` to `to`, bowed `bend` of its
 * length to the left of travel (0: straight), for a move's keyframes.
 */
export function trace(from: Point, to: Point, bend: number, steps: number): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // The bow's control point: off the middle of the way, on its left.
  const via = { x: from.x + dx / 2 + dy * bend, y: from.y + dy / 2 - dx * bend };
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return {
      x: u * u * from.x + 2 * u * t * via.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * via.y + t * t * to.y,
    };
  });
}

/**
 * When each stream leaves Aski, in ms from the first, in `targets`' order:
 * the nearest first, `stagger` apart, and never more than `most` in flight,
 * each `travel` long. Every stream is straight from one point, so no two
 * ways cross.
 */
export function streamStarts(
  origin: Point,
  targets: readonly Point[],
  timing: { readonly stagger: number; readonly travel: number; readonly most?: number },
): number[] {
  const most = timing.most ?? MOST_IN_FLIGHT;
  const away = (p: Point) => Math.hypot(p.x - origin.x, p.y - origin.y);
  const order = targets.map((_, i) => i).toSorted((a, b) => away(targets[a]!) - away(targets[b]!));
  const starts: number[] = [];
  const byTarget: number[] = Array.from({ length: targets.length }, () => 0);
  order.forEach((target, k) => {
    const start = Math.max(k * timing.stagger, k >= most ? starts[k - most]! + timing.travel : 0);
    starts.push(start);
    byTarget[target] = start;
  });
  return byTarget;
}
