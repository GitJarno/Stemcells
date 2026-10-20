// One clock for every Cell on screen: it beats twelve times a second, on
// the beat every scene's frames are drawn on, and only while some Cell can
// be seen moving. A Cell off screen holds its frame; under Reduce Motion it
// stands still, eyes open; while the window is hidden nothing beats.

import { reducedMotion } from "../tokens/motion.ts";
import { clockSeconds } from "./blink.ts";
import { BEAT } from "./scene.ts";

const BEAT_MS = 1000 / BEAT;

/** What a Cell draws: at a moment on `clockSeconds`, or `undefined` to stand still. */
export type Draw = (seconds: number | undefined) => void;

const beating = new Set<Draw>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** The next beat, on the clock's own boundaries, so a frame shows the moment it is due. */
function schedule(): void {
  if (timer !== undefined || beating.size === 0 || document.hidden) return;
  const now = Date.now();
  const due = now + BEAT_MS - (now % BEAT_MS);
  timer = setTimeout(() => {
    timer = undefined;
    const seconds = clockSeconds(Math.max(Date.now(), due));
    for (const draw of beating) draw(seconds);
    schedule();
  }, due - now);
}

/** Every Cell on the clock, told to look again when something all of them depend on changes. */
const staged = new Set<() => void>();
const again = () => {
  for (const update of staged) update();
};

let watching = false;

/** Listens once, the first time a Cell takes the stage: the window, Reduce Motion, the display's density. */
function watch(): void {
  if (watching) return;
  watching = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer);
      timer = undefined;
    } else {
      again();
    }
  });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", again);
  // A query on the density now fires once when it changes: ask again each time.
  const density = () =>
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener(
      "change",
      () => {
        again();
        density();
      },
      { once: true },
    );
  density();
}

const seenBy = new Map<Element, (seen: boolean) => void>();
let observer: IntersectionObserver | undefined;

/**
 * Puts the Cell drawn in `element` on the clock: `draw` is called each beat
 * while the Cell can be seen and may move, once with `undefined` when it must
 * stand still, and again whenever the display's density changes. Returns
 * what takes it off.
 */
export function onStage(element: Element, draw: Draw): () => void {
  watch();
  let seen = true;
  const update = () => {
    if (reducedMotion()) {
      beating.delete(draw);
      draw(undefined);
    } else if (seen) {
      beating.add(draw);
      draw(clockSeconds());
      schedule();
    } else {
      beating.delete(draw);
    }
  };
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) seenBy.get(entry.target)?.(entry.isIntersecting);
  });
  seenBy.set(element, (now) => {
    seen = now;
    update();
  });
  observer.observe(element);
  staged.add(update);
  update();
  return () => {
    staged.delete(update);
    beating.delete(draw);
    seenBy.delete(element);
    observer?.unobserve(element);
  };
}
