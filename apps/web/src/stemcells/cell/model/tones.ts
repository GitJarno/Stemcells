// The colours a sprite is drawn in: five tones a material, pixel-art style.

export type Rgb = readonly [number, number, number];

const blend = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const BLACK: Rgb = [0, 0, 0];

/** Shadow, base, light, gloss, outline. Shadows lean violet and lights lean warm. */
const rampOf = (base: Rgb): readonly [Rgb, Rgb, Rgb, Rgb, Rgb] => [
  blend(blend(base, [52, 24, 92], 0.42), BLACK, 0.1),
  base,
  blend(base, [255, 238, 196], 0.34),
  blend(base, [255, 255, 255], 0.74),
  blend(blend(base, [28, 10, 52], 0.62), BLACK, 0.3),
];

export type Ramp = ReturnType<typeof rampOf>;

export const INK: Rgb = [21, 17, 15];
export const SCREEN_LIT: Rgb = [255, 244, 222];
export const SCREEN_DARK: Rgb = [14, 15, 22];
export const SCREEN_DIM: Rgb = [34, 38, 56];
export const SCREEN_LINE: Rgb = [40, 44, 60];

/** A shape's `tone`: the body's is its provider's colour, the rest are fixed. */
export const TONE = {
  body: 0,
  metal: 1,
  lid: 2,
  navy: 3,
  navyFold: 4,
  cream: 5,
  graphite: 6,
  red: 7,
  leather: 8,
  tan: 9,
} as const;

const FIXED: readonly Ramp[] = [
  rampOf([150, 154, 168]),
  rampOf([92, 96, 112]),
  rampOf([56, 72, 160]),
  rampOf([90, 108, 196]),
  rampOf([236, 227, 210]),
  rampOf([52, 54, 64]),
  rampOf([200, 69, 63]),
  rampOf([138, 90, 60]),
  rampOf([185, 133, 82]),
];

/** Every tone's ramp for a body of colour `hue`, by `TONE`. */
export const rampsOf = (hue: Rgb): readonly Ramp[] => [rampOf(hue), ...FIXED];

export const mixed = blend;
