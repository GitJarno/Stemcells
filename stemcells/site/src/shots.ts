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
  "shown-queries":
    "Every search as a 3D landscape in the chat, fallen nearly flat: 18 ms, and eight typos still tall.",
  "shown-flow":
    "A search's way through the system as streams in the chat: most through the index, four in ten from the cache.",
  "shown-code": "The codebase as a galaxy in the chat: the nine changed files alight.",
  "shown-page": "The results page in the chat, pulled apart into its five layers.",
  "shape-one": "One Cell in one window, Aski over the composer.",
  "shape-two": "Two Cells side by side.",
  "shape-four": "Four tabs, and four Cells at work in the open one.",
  "narrow-tablet": "Stemcells in a browser on a tablet.",
  "narrow-phone": "Stemcells in a browser on a phone.",
  "arc-flying-tablet": "On a tablet: the Cell at work, listed under Flying.",
  "arc-input-tablet": "On a tablet: the Cell's question, in the list and in the chat.",
  "arc-flying-phone": "On a phone: a Cell at work on dark mode.",
  "arc-input-phone": "On a phone: the Cell asks one question, with a preview of each answer.",
  "arc-landed-phone": "On a phone: the Cell has landed, and one closing line says what is done.",
  "arc-settled-phone": "On a phone: the Cell is settled.",
  "shown-wall-phone": "On a phone: a reply written as a wall of text about search speed.",
  "shown-queries-phone":
    "On a phone: every search as a 3D landscape in the chat, fallen nearly flat: 18 ms, and eight typos still tall.",
  "shown-flow-phone":
    "On a phone: a search's way through the system as streams in the chat: most through the index, four in ten from the cache.",
  "shown-code-phone":
    "On a phone: the codebase as a galaxy in the chat: the nine changed files alight.",
  "shown-page-phone":
    "On a phone: the results page in the chat, pulled apart into its five layers.",
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
  /** The open Cell's answer with a page in it: the person's message, the page and the line under it. */
  page: framed(328, 45, 992),
  /** The stages' list at the foot of the column, and the line that says it is settled. */
  stages: framed(0, 376, 800),
  /** A fresh Cell: Aski over the composer. */
  fresh: framed(388, 318, 920),
} as const;

/** A framing on a phone's screen: a phone's frame shows the screen at its full width, so a framing is how far down it looks. */
export const band = (y: number, h: number): Box => ({ x: 0, y, w: 393, h });

/** The words in one answer told, and in each shown (`shots/rig/words.mjs`). */
export const WORDS = {
  "shown-wall": 227,
  "shown-queries": 8,
  "shown-flow": 7,
  "shown-code": 7,
  "shown-page": 9,
} as const;
