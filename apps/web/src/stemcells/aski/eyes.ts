// Aski's eyes at rest, which are theater: they blink on the wall clock, so
// every place that shows Aski blinks together, and they follow the caret
// while you type to Aski, else the pointer while it moves over Aski's
// place, letting go a while after it stops or as soon as it leaves; while
// Aski answers it thinks, its eyes resting up and a little to the left
// without a blink; while words stand in Aski's field it listens, and while
// anything waits on the person, they blink like a cursor instead, at rest
// off screen; eyes wearing a mood hold it without a blink. The figure
// draws each eye on layers of its own (stage/figure.ts); a blink squashes
// them toward a sliver and a look moves them in whole device pixels, both
// by transform alone, so none draws Aski again.
// Under Reduce Motion the eyes don't blink, and they cut to where they look
// (aski.css).

import { reducedMotion } from "../tokens/motion.ts";
import { BLINK, IDLE_BLINKS, idleBlinks } from "./acts.ts";

/** A point on the page, in client pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The seed of the blinks: one Aski, one rhythm everywhere. */
const SEED = 1;
/** How long a pointer that stopped moving keeps the eyes, in milliseconds. */
const HOLD = 3000;
/** Where the eyes rest while Aski thinks: up, a little to the left, in shares of how far they go. */
const THINKING = { x: -0.3, y: -0.5 } as const;

/** A move of the eyes in CSS pixels, stepped to whole device pixels so a block's edges stay crisp where it looks. */
const step = (px: number): number => Math.round(px * devicePixelRatio) / devicePixelRatio;
/** The eyes moved by `x`, `y` CSS pixels, each stepped to whole device pixels. */
const shifted = (x: number, y: number): string => `translate(${step(x)}px, ${step(y)}px)`;

/** The eyes that blink: each figure's open eyes, and its shut ones. */
const open = new Map<HTMLElement, HTMLElement>();
let timer: ReturnType<typeof setTimeout> | undefined;
/** The last blink's start, in seconds of the wall clock: the next comes after it. */
let last = 0;

function blink(): void {
  if (document.hidden || reducedMotion()) return;
  const { close, open: opening, shut } = BLINK;
  const timing = { duration: (close + opening) * 1000 };
  const offset = close / (close + opening);
  // The open eyes squash toward the line and give way to the shut ones, drawn as a line, then come back.
  const squash: Keyframe[] = [
    { transform: "scale(1, 1)", opacity: 1 },
    { transform: `scale(1, ${shut})`, opacity: 0, offset },
    { transform: "scale(1, 1)", opacity: 1 },
  ];
  const line: Keyframe[] = [{ opacity: 0 }, { opacity: 1, offset }, { opacity: 0 }];
  for (const [eyes, shutEyes] of open) {
    // Eyes blinking like a cursor keep that beat alone; thinking ones and ones wearing a mood hold still.
    if (!eyes.isConnected || eyes.closest("[data-waiting], [data-thinking], [data-mood]") !== null)
      continue;
    eyes.animate(squash, timing);
    shutEyes.animate(line, timing);
  }
}

/** Waits for the next blink, while any eyes are open. */
function next(): void {
  timer = undefined;
  if (open.size === 0) return;
  const now = Math.max(Date.now() / 1000, last + 0.001);
  const [at] = idleBlinks(now, now + 2 * IDLE_BLINKS.slot, SEED);
  if (at === undefined) return;
  timer = setTimeout(
    () => {
      last = at;
      blink();
      next();
    },
    (at - now) * 1000,
  );
}

/** A figure's eyes, open and shut, blink with every other Aski on the page until the returned function stills them. */
export function blinking(eyes: HTMLElement, shut: HTMLElement): () => void {
  open.set(eyes, shut);
  if (timer === undefined) next();
  return () => {
    open.delete(eyes);
    if (open.size === 0 && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

/** A cursor's beat, open then shut, in milliseconds: the eyes open half of it and shut the other half. */
const CURSOR = 1060;

/**
 * An eye, open and shut, blinks like a cursor until the animations are
 * cancelled: on whole beats of the wall clock, so every Aski keeps one beat.
 */
export function cursoring(eye: HTMLElement, shut: HTMLElement): Animation[] {
  const timing = { duration: CURSOR, iterations: Number.POSITIVE_INFINITY };
  const beats = [
    eye.animate(
      [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }],
      timing,
    ),
    shut.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }],
      timing,
    ),
  ];
  for (const beat of beats) beat.currentTime = Date.now() % timing.duration;
  return beats;
}

/** Where the eyes look from and how far they go, in fractions of the figure's box. */
export interface Aim {
  readonly x: number;
  readonly y: number;
  readonly travelX: number;
  readonly travelY: number;
}

/** What else holds the eyes, read each time they look. */
export interface Holding {
  /** Aski is thinking: its eyes rest up and a little to the left. */
  readonly thinks: boolean;
}

/** The eyes' handle: look again, take the caret, hear that Aski began or stopped thinking, let go. */
export interface Looking {
  readonly look: () => void;
  readonly caret: (at: Point | undefined) => void;
  readonly thought: (now: boolean) => void;
  readonly stop: () => void;
}

/**
 * The eyes follow the caret of Aski's field while it has the keyboard, else
 * the pointer over Aski's place: the nearest element marked
 * `data-aski-looks` around the figure, else the figure itself. They look
 * all the way toward a point a figure's height away or more, and part way
 * toward one nearer; the caret and the pointer let them go `HOLD` after
 * they last moved, the pointer at once as it leaves. With neither, the eyes
 * look up and a little to the left while Aski thinks, else ahead; Aski
 * beginning to think lets the caret go.
 */
export function looking(
  figure: HTMLElement,
  eyes: HTMLElement,
  aim: () => Aim | undefined,
  holding: () => Holding,
): Looking {
  const place = figure.parentElement?.closest<HTMLElement>("[data-aski-looks]") ?? figure;
  /** What holds the eyes, and since when. */
  const held: { caret: Held | undefined; pointer: Held | undefined } = {
    caret: undefined,
    pointer: undefined,
  };
  let hold: ReturnType<typeof setTimeout> | undefined;
  const look = (): void => {
    if (hold !== undefined) clearTimeout(hold);
    hold = undefined;
    const now = Date.now();
    const live = (h: Held | undefined): Held | undefined =>
      h !== undefined && now - h.at < HOLD ? h : undefined;
    const to = aim();
    const box = figure.getBoundingClientRect();
    const by = live(held.caret) ?? live(held.pointer);
    if (to === undefined || box.height === 0) {
      eyes.style.transform = "";
      return;
    }
    if (by === undefined) {
      eyes.style.transform = holding().thinks
        ? shifted(THINKING.x * to.travelX * box.width, THINKING.y * to.travelY * box.height)
        : "";
      return;
    }
    hold = setTimeout(look, HOLD - (now - by.at));
    const dx = by.x - (box.left + to.x * box.width);
    const dy = by.y - (box.top + to.y * box.height);
    const d = Math.hypot(dx, dy);
    const k = d === 0 ? 0 : Math.min(1, d / box.height) / d;
    eyes.style.transform = shifted(
      dx * k * to.travelX * box.width,
      dy * k * to.travelY * box.height,
    );
  };
  const moved = (event: PointerEvent): void => {
    held.pointer = { x: event.clientX, y: event.clientY, at: Date.now() };
    look();
  };
  const left = (): void => {
    held.pointer = undefined;
    look();
  };
  place.addEventListener("pointermove", moved);
  place.addEventListener("pointerleave", left);
  return {
    look,
    caret(at) {
      held.caret = at === undefined ? undefined : { ...at, at: Date.now() };
      look();
    },
    // Aski beginning to think turns the eyes from the words it took to the thought; words typed after take them back.
    thought(now) {
      if (now) held.caret = undefined;
      look();
    },
    stop() {
      place.removeEventListener("pointermove", moved);
      place.removeEventListener("pointerleave", left);
      if (hold !== undefined) clearTimeout(hold);
    },
  };
}

/** A point that holds the eyes, and when it last moved. */
interface Held {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}
