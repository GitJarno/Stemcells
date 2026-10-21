// A moment's line, typed beside Aski at its moment: a character at a time
// behind a block cursor, which blinks on the cursor's beat a while after the
// last one, as Aski's eyes blink when it waits. Still (Reduce Motion), the
// line is there whole from its moment, with no cursor.

import { CURSOR, cursorPhase } from "../eyes.ts";

/** Characters a second, and how long the cursor stays after the last one, in milliseconds. */
export const TYPING = { cps: 16, hold: 2_000 } as const;

/** How long `line` takes to type, in milliseconds. */
export const typingFor = (line: string): number => ([...line].length / TYPING.cps) * 1000;

/**
 * Types `line` into `typed` from `from` (Unix milliseconds), `cursor` after
 * it; `still` shows it whole. Returns what clears it again.
 */
export function typeLine(
  typed: HTMLElement,
  cursor: HTMLElement,
  line: string,
  from: number,
  still: boolean,
): () => void {
  const chars = [...line];
  const done = from + typingFor(line);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let blink: Animation | undefined;
  const step = (): void => {
    const now = Date.now();
    if (now < from) {
      timer = setTimeout(step, from - now);
      return;
    }
    if (still) {
      typed.textContent = line;
      return;
    }
    const n = Math.min(chars.length, Math.floor(((now - from) / 1000) * TYPING.cps));
    typed.textContent = chars.slice(0, n).join("");
    if (n < chars.length) {
      cursor.hidden = false;
      timer = setTimeout(step, 1000 / TYPING.cps);
    } else if (now < done + TYPING.hold) {
      cursor.hidden = false;
      blink = cursor.animate(
        [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }],
        { duration: CURSOR, iterations: Number.POSITIVE_INFINITY },
      );
      blink.currentTime = cursorPhase(now);
      timer = setTimeout(step, done + TYPING.hold - now);
    } else {
      blink?.cancel();
      cursor.hidden = true;
    }
  };
  step();
  return () => {
    clearTimeout(timer);
    blink?.cancel();
    typed.textContent = "";
    cursor.hidden = true;
  };
}
