// The canonical body. Every renderer, size and motion starts from these numbers;
// change one and every golden frame changes with it, on purpose.
//
// Units are canon units: Aski stands about 224 tall, x grows right, y grows down,
// and (0, 0) is the ground point between its feet.

export interface Lobe {
  readonly name: "crown" | "right" | "left" | "footL" | "footR";
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** Spring stiffness and damping ratio: the crown is softest, the feet stay planted. */
  readonly k: number;
  readonly zeta: number;
}

export const LOBES: readonly Lobe[] = [
  { name: "crown", x: 8.8, y: -153.3, r: 68.6, k: 150, zeta: 0.3 },
  { name: "right", x: 67, y: -139.1, r: 50, k: 230, zeta: 0.36 },
  { name: "left", x: -62.9, y: -108.9, r: 54.9, k: 230, zeta: 0.36 },
  { name: "footL", x: -39.8, y: -55.7, r: 53.8, k: 560, zeta: 0.78 },
  { name: "footR", x: 49.7, y: -60.2, r: 60.9, k: 560, zeta: 0.78 },
];

export const CROWN = 0,
  RIGHT = 1,
  LEFT = 2,
  FOOT_L = 3,
  FOOT_R = 4;

/**
 * Where the two block eyes sit (ink centres) and how tall they are: level, as
 * the canon types them, a block's width apart. They ride the crown.
 */
export const EYES = {
  centers: [
    [6, -151],
    [56, -151],
  ] as const,
  height: 47,
};

/** At rest the lobes meet almost edge to edge; motion softens the joins. */
export const GOO = { rest: 3, walk: 16, melt: 46, wave: 34, tuck: 10, squash: 6, limbs: 12 };

export const PALETTE = {
  ink: [13, 14, 16] as const,
  sky: [232, 237, 241] as const,
  mist: [201, 210, 218] as const,
  /** The one warm colour, only for a scene's one living thing (a koi's gold). */
  warm: [190, 128, 16] as const,
};

export const BODY_TOP = Math.min(...LOBES.map((l) => l.y - l.r));
export const BODY_HEIGHT = -BODY_TOP;
