// The one clock every Cell on screen reads its frames and blinks from: the
// web's 12 beats a second, ticking only while a figure listens and the app
// is in front. A figure draws again only when its frame changes, so a still
// Cell costs a frame when it blinks, every four seconds.

import { AppState } from "react-native";

import { clockSeconds } from "./kit";

/** The sprite clock's beat (`scene.ts`' `BEAT`). */
const BEAT_MS = 1000 / 12;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let inFront = AppState.currentState === "active";
/** The beat's time, held between ticks so every figure reads one moment. */
let beat = clockSeconds();

function tick(): void {
  beat = clockSeconds();
  for (const listener of listeners) listener();
}

function sync(): void {
  const runs = inFront && listeners.size > 0;
  if (runs && timer === undefined) {
    beat = clockSeconds();
    timer = setInterval(tick, BEAT_MS);
  }
  if (!runs && timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

AppState.addEventListener("change", (state) => {
  inFront = state === "active";
  sync();
  if (inFront) tick();
});

/** Listens to the beat; the returned function stops listening. */
export function onBeat(listener: () => void): () => void {
  listeners.add(listener);
  sync();
  return () => {
    listeners.delete(listener);
    sync();
  };
}

/** Never ticks: what a figure held still listens to. */
export const never = (): (() => void) => () => undefined;

/** The time a figure draws: the last beat's while the clock runs. */
export const now = (): number => (timer === undefined ? clockSeconds() : beat);
