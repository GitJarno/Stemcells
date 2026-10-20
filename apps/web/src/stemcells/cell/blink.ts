// When a Cell blinks: once in every four seconds, at a moment its name
// picks for each window, so Cells side by side never blink in step. One that
// waits on you blinks on a text caret's beat instead. Times count from the
// original app's reference date (2001-01-01, UTC), as its clocks did, so a
// Cell blinks at the same moment on every screen.

/** Milliseconds from the Unix epoch to the reference date. */
const REFERENCE_MS = 978_307_200_000;

/** Now, in seconds from the reference date: the clock every Cell's frames and blinks are read from. */
export const clockSeconds = (now: number = Date.now()): number => (now - REFERENCE_MS) / 1000;

const PERIOD_MS = 4000;
const DURATION_MS = 150;
/** Starts land in [EARLIEST_MS, LATEST_MS] of a window, so two blinks are never closer than half a second across a window's edge. */
const EARLIEST_MS = 250;
const LATEST_MS = 3600;
/** A pleading Cell's half-period: a text caret's. */
const PLEA_MS = 530;

/** 32-bit FNV-1a over the text's UTF-8. */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 0x01000193);
  return hash >>> 0;
}

/** Where the blink starts inside `window` (each `PERIOD_MS` long), in milliseconds. */
export function blinkStart(seed: string, window: number): number {
  return EARLIEST_MS + (fnv1a32(`${seed}#${window}`) % (LATEST_MS - EARLIEST_MS + 1));
}

/** Counts past this (a 32-bit integer's range) never blink, as in the original. */
const LONGEST = 2 ** 31 - 1;

/** Whether the eyes of the Cell `seed` names are shut at `seconds` (on `clockSeconds`); `pleading`, on the caret's beat. */
export function isBlinking(seed: string, seconds: number, pleading = false): boolean {
  const ms = seconds * 1000;
  if (!Number.isFinite(ms)) return false;
  if (pleading) {
    const beat = Math.floor(ms / PLEA_MS);
    return Math.abs(beat) < LONGEST && Math.abs(beat) % 2 === 1;
  }
  const window = Math.floor(ms / PERIOD_MS);
  if (Math.abs(window) >= LONGEST) return false;
  const into = ms - window * PERIOD_MS;
  const start = blinkStart(seed, window);
  return into >= start && into < start + DURATION_MS;
}
