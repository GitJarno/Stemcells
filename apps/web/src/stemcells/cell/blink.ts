// When a Cell blinks: once a window (the original's, every four seconds; a temperament's own),
// at a moment its name picks for each window, so Cells side by side never blink in step; one
// waiting on you blinks on a caret's beat. Times count from the original app's reference date
// (2001-01-01, UTC), so a Cell blinks at the same moment on every screen.

/** Milliseconds from the Unix epoch to the reference date. */
const REFERENCE_MS = 978_307_200_000;

/** Now, in seconds from the reference date: the clock every Cell's frames and blinks are read from. */
export const clockSeconds = (now: number = Date.now()): number => (now - REFERENCE_MS) / 1000;

/** How a Cell blinks: once a window, shut this long, and now and then twice. */
export interface Cadence {
  readonly windowMs: number;
  readonly shutMs: number;
  readonly double: boolean;
}

/** The original's blink: once every four seconds. */
const BLINK: Cadence = { windowMs: 4000, shutMs: 150, double: false };

/** Starts land from `EARLIEST_MS` into a window to `MARGIN_MS` before its end, so two blinks are never closer than half a second across a window's edge. */
const EARLIEST_MS = 250;
const MARGIN_MS = 400;
/** Eyes open between the two of a double blink. */
const BETWEEN_MS = 180;
/** One window in this many holds a double blink, for a Cell that blinks twice. */
const DOUBLES = 3;
/** A pleading Cell's half-period: a text caret's. */
const PLEA_MS = 530;

const UTF8 = new TextEncoder();

/** 32-bit FNV-1a over the text's UTF-8. */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of UTF8.encode(text)) hash = Math.imul(hash ^ byte, 0x01000193);
  return hash >>> 0;
}

/** Where the blink starts inside `window` (each `cadence.windowMs` long), in milliseconds. */
export function blinkStart(seed: string, window: number, cadence: Cadence = BLINK): number {
  const twice = cadence.double ? cadence.shutMs + BETWEEN_MS : 0;
  const latest = cadence.windowMs - MARGIN_MS - twice;
  return EARLIEST_MS + (fnv1a32(`${seed}#${window}`) % (latest - EARLIEST_MS + 1));
}

/** Counts past this (a 32-bit integer's range) never blink, as in the original. */
const LONGEST = 2 ** 31 - 1;

/**
 * Whether the eyes of the Cell `seed` names are shut at `seconds` (on `clockSeconds`), blinking
 * on `cadence`; `pleading`, on the caret's beat, the same for every Cell.
 */
export function isBlinking(
  seed: string,
  seconds: number,
  pleading = false,
  cadence: Cadence = BLINK,
): boolean {
  const ms = seconds * 1000;
  if (!Number.isFinite(ms)) return false;
  if (pleading) {
    const beat = Math.floor(ms / PLEA_MS);
    return Math.abs(beat) < LONGEST && Math.abs(beat) % 2 === 1;
  }
  const window = Math.floor(ms / cadence.windowMs);
  if (Math.abs(window) >= LONGEST) return false;
  const into = ms - window * cadence.windowMs;
  let blink = asked.get(seed);
  if (blink?.window !== window || blink.cadence !== cadence) {
    const start = blinkStart(seed, window, cadence);
    const twice = cadence.double && fnv1a32(`${seed}#${window}#twice`) % DOUBLES === 0;
    blink = { window, cadence, start, again: twice ? start + cadence.shutMs + BETWEEN_MS : -1 };
    asked.set(seed, blink);
  }
  const shutFrom = (start: number) => start >= 0 && into >= start && into < start + cadence.shutMs;
  return shutFrom(blink.start) || shutFrom(blink.again);
}

/** The blink of the window each Cell was last asked about: a Cell is asked every beat, and its window lasts seconds. */
const asked = new Map<string, { window: number; cadence: Cadence; start: number; again: number }>();
