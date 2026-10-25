// Aski's blinks, as the Mac's (`apps/web/src/stemcells/aski/eyes.ts`): on
// the wall clock's idle rhythm, so every Aski on screen blinks together and
// with the Mac's. One timer waits for the next blink while any Aski listens
// and the app is in front; nothing runs between blinks.

import { AppState } from "react-native";

import { IDLE_BLINKS, idleBlinks } from "./kit";

/** The blinks' seed: one Aski, one rhythm everywhere (the web's). */
const SEED = 1;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let inFront = AppState.currentState === "active";
/** The last blink's start, wall-clock seconds: the next comes after it. */
let last = 0;

function next(): void {
  clearTimeout(timer);
  timer = undefined;
  if (!inFront || listeners.size === 0) return;
  const now = Math.max(Date.now() / 1000, last + 0.001);
  const [at] = idleBlinks(now, now + 2 * IDLE_BLINKS.slot, SEED);
  if (at === undefined) return;
  timer = setTimeout(
    () => {
      last = at;
      for (const listener of listeners) listener();
      next();
    },
    (at - now) * 1000,
  );
}

AppState.addEventListener("change", (state) => {
  inFront = state === "active";
  next();
});

/** Hears each blink as it starts; the returned function stops hearing them. */
export function onBlink(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) next();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) next();
  };
}
