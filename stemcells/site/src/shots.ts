// The app's own screens the page shows (`public/app/`), and where things are
// on each, in the screen's CSS pixels. `shots/README.md` says how they are made.

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Shot {
  readonly w: number;
  readonly h: number;
  /** A half-size copy exists beside it. */
  readonly small: boolean;
  readonly alt: string;
  readonly rects: Readonly<Record<string, Box>>;
}

const mac = (alt: string, rects: Readonly<Record<string, Box>> = {}): Shot => ({
  w: 1440,
  h: 900,
  small: true,
  alt,
  rects,
});

const COLUMN: Box = { x: 0, y: 0, w: 346, h: 900 };
const STAGES: Box = { x: 8, y: 668, w: 330, h: 160 };
const PANE: Box = { x: 358, y: 58, w: 1070, h: 830 };

export const shots = {
  crew: mac("Stemcells on a Mac: Cells listed by stage beside two chats at work.", {
    column: COLUMN,
    stages: STAGES,
    pane: PANE,
  }),
  "arc-flying": mac("A Cell at work: it is listed under Flying.", {
    column: COLUMN,
    stages: STAGES,
    pane: PANE,
  }),
  "arc-input": mac("The Cell asks one question, with a preview of each answer.", {
    column: COLUMN,
    stages: STAGES,
    pane: PANE,
    ask: { x: 12, y: 150, w: 322, h: 200 },
  }),
  "arc-landed": mac("The Cell has landed: one closing line says what is done.", {
    column: COLUMN,
    stages: STAGES,
    pane: PANE,
    closeOut: { x: 620, y: 600, w: 560, h: 120 },
  }),
  "arc-settled": mac("The Cell is settled: nothing needs you.", {
    column: COLUMN,
    stages: STAGES,
    pane: PANE,
    settled: { x: 8, y: 790, w: 330, h: 34 },
  }),
  "shown-wall": mac("A reply written as a wall of text.", { reply: PANE }),
  "shown-chart": mac("The same reply as a chart.", { chart: { x: 620, y: 300, w: 560, h: 300 } }),
  "shown-diagram": mac("A flow drawn as a diagram.", {
    diagram: { x: 620, y: 300, w: 560, h: 300 },
  }),
  "shown-choice": mac("A question with a preview of each option.", {
    question: { x: 620, y: 400, w: 560, h: 260 },
  }),
  "shown-closeout": mac("One closing line: what is done and what is left.", {
    closeOut: { x: 620, y: 560, w: 560, h: 140 },
  }),
  "shape-one": mac("One Cell in one window."),
  "shape-two": mac("Two Cells side by side."),
  "shape-four": mac("Four tabs, and four Cells in the open one."),
  "narrow-tablet": {
    w: 834,
    h: 1194,
    small: false,
    alt: "Stemcells in a browser on a tablet.",
    rects: {},
  },
  "narrow-phone": {
    w: 393,
    h: 852,
    small: false,
    alt: "Stemcells in a browser on a phone.",
    rects: {},
  },
} as const satisfies Record<string, Shot>;

export type ShotName = keyof typeof shots;

/** The words a person reads on a screen of a reply, counted from what the Cell said. */
export const WORDS: Partial<Record<ShotName, number>> = {
  "shown-wall": 220,
  "shown-chart": 9,
  "shown-diagram": 5,
  "shown-choice": 14,
  "shown-closeout": 12,
};

/** Where `part` is on `shot`; the whole screen when it has no such part. */
export function part(shot: ShotName, name: string): Box {
  const s: Shot = shots[shot];
  return s.rects[name] ?? { x: 0, y: 0, w: s.w, h: s.h };
}
