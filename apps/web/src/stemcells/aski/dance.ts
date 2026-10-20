// Aski's routine: four moves, one per beat, with a star jump to close each
// sixteen. Offsets are canon units from the
// shoulder ([elbow, hand]) and from the hip ([knee, foot]).

type Limb = readonly [readonly [number, number], readonly [number, number]];
export interface Pose {
  readonly la: Limb;
  readonly ra: Limb;
  readonly ll: Limb;
  readonly rl: Limb;
  readonly sway?: number;
  readonly lift?: number;
}

const P = (
  la: Limb,
  ra: Limb,
  ll: Limb,
  rl: Limb,
  extra: { sway?: number; lift?: number } = {},
): Pose => ({
  la,
  ra,
  ll,
  rl,
  ...extra,
});

export const POSES = {
  up: P(
    [
      [-34, 28],
      [-10, 58],
    ],
    [
      [34, -42],
      [72, -112],
    ],
    [
      [-8, 58],
      [-16, 104],
    ],
    [
      [34, 44],
      [26, 104],
    ],
  ),
  down: P(
    [
      [-34, 42],
      [-82, 98],
    ],
    [
      [34, 28],
      [10, 58],
    ],
    [
      [-34, 44],
      [-26, 104],
    ],
    [
      [8, 58],
      [16, 104],
    ],
  ),
  roofHi: P(
    [
      [-46, -26],
      [-38, -104],
    ],
    [
      [46, -26],
      [38, -104],
    ],
    [
      [-26, 58],
      [-44, 104],
    ],
    [
      [26, 58],
      [44, 104],
    ],
  ),
  roofLo: P(
    [
      [-48, -8],
      [-42, -64],
    ],
    [
      [48, -8],
      [42, -64],
    ],
    [
      [-30, 50],
      [-50, 94],
    ],
    [
      [30, 50],
      [50, 94],
    ],
  ),
  grooveL: P(
    [
      [-38, 40],
      [-66, 12],
    ],
    [
      [38, 40],
      [66, 12],
    ],
    [
      [-26, 42],
      [-8, 88],
    ],
    [
      [24, 48],
      [8, 92],
    ],
    { sway: -14 },
  ),
  grooveR: P(
    [
      [-38, 40],
      [-66, 12],
    ],
    [
      [38, 40],
      [66, 12],
    ],
    [
      [-24, 48],
      [-8, 92],
    ],
    [
      [26, 42],
      [8, 88],
    ],
    { sway: 14 },
  ),
  star: P(
    [
      [-52, -22],
      [-100, -46],
    ],
    [
      [52, -22],
      [100, -46],
    ],
    [
      [-48, 34],
      [-92, 64],
    ],
    [
      [48, 34],
      [92, 64],
    ],
    { lift: 56 },
  ),
} as const;

export const ROUTINE: readonly (keyof typeof POSES)[] = [
  "up",
  "down",
  "up",
  "down",
  "up",
  "down",
  "up",
  "down",
  "roofHi",
  "roofLo",
  "roofHi",
  "roofLo",
  "grooveL",
  "grooveR",
  "grooveL",
  "star",
];

export const poseAt = (beat: number): Pose =>
  POSES[ROUTINE[Math.floor(Math.max(0, beat)) % ROUTINE.length]!];
