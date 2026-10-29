// Aski at rest as SVG paths (`aski/kit.ts`): where a cell reads, the body is the Mac's skin of
// characters, solid round the eyes, dot for dot; smaller, it is its five lobes, which at rest
// nearly meet (the canon's join is under a point at the phone's sizes). The eyes are the canon's
// blocks, or the characters a mood types into them, each drawn from the web's own outlines.

import {
  BLOCK_WIDTH,
  DOT,
  EYES,
  eyesType,
  GLYPHS,
  LOBES,
  type Mood,
  MOODS,
  restingInk,
  wearsSkin,
} from "./kit";

const left = Math.min(...LOBES.map((lobe) => lobe.x - lobe.r));
const right = Math.max(...LOBES.map((lobe) => lobe.x + lobe.r));
const top = Math.min(...LOBES.map((lobe) => lobe.y - lobe.r));
const bottom = Math.max(...LOBES.map((lobe) => lobe.y + lobe.r));

/** The body's box, canon units. */
export const VIEW = { x: left, y: top, width: right - left, height: bottom - top } as const;

const round = (value: number) => Math.round(value * 100) / 100;

/** The body: each lobe a circle in one direction, so where they overlap they fill as one. */
export const BODY = LOBES.map(
  ({ x, y, r }) =>
    `M${round(x - r)} ${round(y)}a${r} ${r} 0 1 0 ${round(2 * r)} 0a${r} ${r} 0 1 0 ${round(-2 * r)} 0z`,
).join("");

const box = (unit: number): string =>
  `${VIEW.x / unit} ${VIEW.y / unit} ${VIEW.width / unit} ${VIEW.height / unit}`;
const SOLID = { body: BODY, viewBox: box(1) } as const;
let skinned: typeof SOLID | undefined;

/** The skin, in dots (`DOT` canon units), worked out when first worn. */
export function skin() {
  skinned ??= {
    body: restingInk()
      .map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`)
      .join(""),
    viewBox: box(DOT),
  };
  return skinned;
}

/**
 * Aski `height` points tall on a screen of `pixelRatio` pixels to the point, by the Mac's sizes:
 * its body and the box it is drawn in, and whether its eyes read a mood typed into them.
 */
export function figureAt(height: number, pixelRatio: number) {
  const scale = (height * pixelRatio) / VIEW.height;
  return { ...(wearsSkin(scale) ? skin() : SOLID), typed: eyesType(scale) };
}

/** An outline in an eye one unit tall, placed on the eye centred at (`cx`, `cy`). */
const outlinePath = (outline: Float64Array, cx: number, cy: number): string => {
  let d = "";
  for (let i = 0; i < outline.length; i += 2)
    d += `${i === 0 ? "M" : "L"}${round(cx + outline[i]! * EYES.height)} ${round(cy + outline[i + 1]! * EYES.height)}`;
  return `${d}Z`;
};

/** The eyes' band, canon units: where a blink squashes them toward. */
export const EYE_LINE = EYES.centers[0][1];

/** Both eyes as one path: blocks, or the characters `mood` types into them. */
export function eyesPath(mood: Mood | undefined): string {
  const typed = mood === undefined ? undefined : MOODS[mood];
  return EYES.centers
    .map(([cx, cy], side) => {
      const outlines = typed === undefined ? undefined : GLYPHS[typed[side]!];
      if (outlines !== undefined)
        return outlines.map((outline) => outlinePath(outline, cx, cy)).join("");
      const w = (BLOCK_WIDTH * EYES.height) / 2;
      const h = EYES.height / 2;
      return `M${round(cx - w)} ${round(cy - h)}H${round(cx + w)}V${round(cy + h)}H${round(cx - w)}Z`;
    })
    .join("");
}
