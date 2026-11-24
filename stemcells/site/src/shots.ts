// The app's own screens the page shows (`public/app/`): what each is, where
// things are on it (`shots.data.ts`, measured in the app), and the framings
// the camera takes. `shots/README.md` says how they are made.

import { SHOTS } from "./shots.data.ts";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type ShotName = keyof typeof SHOTS;

/** What each screen shows, for someone who cannot see it. */
export const ALT: Readonly<Record<ShotName, string>> = {
  crew: "Stemcells on a Mac: Cells listed by stage, one question waiting, two chats at work.",
  "arc-flying": "A Cell at work on dark mode: it is listed under Flying.",
  "arc-input": "The Cell asks one question, with a preview of each answer.",
  "arc-landed": "The Cell has landed: one closing line says what is done.",
  "arc-settled": "The Cell is settled: it is listed under Settled and nothing needs you.",
  "shown-wall": "A reply written as a wall of text about search speed.",
  "shown-chart": "The same reply as a chart of search latency.",
  "shown-diagram": "How a search query travels, drawn as a diagram.",
  "shown-choice": "A question with a preview of each option.",
  "shown-closeout": "One closing card: what is done and what is left, by owner.",
  "shape-one": "One Cell in one window, Aski over the composer.",
  "shape-two": "Two Cells side by side.",
  "shape-four": "Four tabs, and four Cells at work in the open one.",
  "narrow-tablet": "Stemcells in a browser on a tablet.",
  "narrow-phone": "Stemcells in a browser on a phone.",
};

export const sizeOf = (shot: ShotName): { readonly w: number; readonly h: number } => SHOTS[shot];
export const hasSmall = (shot: ShotName): boolean => SHOTS[shot].small;

/** Where `name` is on `shot`; the whole screen when it has no such part. */
export function part(shot: ShotName, name: string): Box {
  const rects: Readonly<Record<string, Box>> = SHOTS[shot].rects;
  return rects[name] ?? { x: 0, y: 0, w: SHOTS[shot].w, h: SHOTS[shot].h };
}

/** A framing: a part of a Mac's screen in the screen's own shape, so a window's frame shows it edge to edge. */
const framed = (x: number, y: number, w: number): Box => ({ x, y, w, h: (w * 900) / 1440 });

/** The framings the camera takes on a Mac's screen. */
export const VIEW = {
  whole: framed(0, 0, 1440),
  /** The question in the column, with its previews, and the head of the chat. */
  ask: framed(0, 78, 770),
  /** The open Cell's answer, from the person's message down. */
  answer: framed(450, 46, 796),
  /** The foot of the open Cell: its question or its composer. */
  foot: framed(450, 388, 796),
  /** The stages' list at the foot of the column, and the line that says it is settled. */
  stages: framed(0, 346, 800),
  /** A fresh Cell: Aski over the composer. */
  fresh: framed(388, 318, 920),
} as const;

/** The words a person reads in one answer told two ways: as the Cell's prose, and as its sentence with a chart's labels. */
export const WORDS: Partial<Record<ShotName, number>> = {
  "shown-wall": 227,
  "shown-chart": 24,
};
