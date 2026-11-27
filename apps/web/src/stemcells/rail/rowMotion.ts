import { useLayoutEffect, useRef } from "react";

import { cssEasing, enteredRows, LIST_MOTION, type ListReading } from "../motion/listMotion";
import { reducedMotion } from "../tokens/motion";

const MOVE = { duration: LIST_MOTION.move.duration, easing: cssEasing(LIST_MOTION.move.easing) };
const ENTER = { duration: LIST_MOTION.enter.duration, easing: cssEasing(LIST_MOTION.enter.easing) };
const BLOOM = LIST_MOTION.bloom.rise + LIST_MOTION.bloom.fall;
const NONE: ReadonlySet<string> = new Set();

/**
 * A stage's rows (`keys`, in order) under the lists' one motion (`motion/listMotion.ts`): a row
 * that changed slot glides there, and a row new to the stage fades in the first time the stage
 * is `shown`, then its light blooms once (`--cells-bloom` in cells.css). `view` is what the list
 * shows, null until it has been read; another view is the list read again.
 */
export function useRowMotion(
  keys: ReadonlyArray<string>,
  view: string | null,
  shown: boolean,
  /** Rows whose arrival is their own entrance (`Planned.tsx`): they only fade in, and only with less motion. */
  forming: ReadonlySet<string> = NONE,
) {
  const list = useRef<HTMLOListElement>(null);
  const gliding = useRef(new Map<string, Animation>());
  const tops = useRef(new Map<string, number>());
  const reading = useRef<ListReading | null>(null);
  const entering = useRef(new Set<string>());
  const order = keys.join(" ");

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the rows' places when the rows change and animate those that moved or entered, before paint.
  useLayoutEffect(() => {
    if (view === null) {
      reading.current = null;
      tops.current = new Map();
      return;
    }
    const now = order === "" ? [] : order.split(" ");
    const before = reading.current;
    for (const key of enteredRows(before, view, now)) entering.current.add(key);
    reading.current = { view, keys: new Set(now) };
    const element = list.current;
    const rows = new Map<string, HTMLElement>();
    for (const row of element?.querySelectorAll<HTMLElement>(":scope > [data-cells-thread]") ?? [])
      rows.set(row.dataset.cellsThread!, row);
    const was = before?.view === view ? tops.current : new Map<string, number>();
    // Layout's own place in the list, not where a glide under way has it.
    const base = (row: HTMLElement) =>
      row.offsetParent === element ? 0 : (element?.offsetTop ?? 0);
    tops.current = new Map([...rows].map(([key, row]) => [key, row.offsetTop - base(row)]));
    const still = reducedMotion();
    // A leave folds in CSS and the rows under it follow: nothing of ours moves them meanwhile.
    const lost = before !== null && [...before.keys].some((key) => !rows.has(key));
    const folding = element?.querySelector(":scope > [data-leaving]") != null;
    if (!still && !lost && !folding)
      for (const [key, top] of tops.current) {
        const from = was.get(key);
        if (from === undefined || from === top) continue;
        const row = rows.get(key)!;
        // From where a glide under way has it now, so one arrival after another never jumps it back.
        const under = gliding.current.get(key);
        const off =
          under?.playState === "running"
            ? Number.parseFloat(getComputedStyle(row).translate.split(" ")[1] ?? "") || 0
            : 0;
        under?.cancel();
        const glide = row.animate(
          [{ translate: `0 ${from - top + off}px` }, { translate: "0 0" }],
          MOVE,
        );
        gliding.current.set(key, glide);
        void glide.finished.then(
          () => gliding.current.get(key) === glide && gliding.current.delete(key),
          () => undefined,
        );
      }
    for (const key of entering.current) {
      const row = rows.get(key);
      if (row === undefined) entering.current.delete(key);
      if (row === undefined || !shown) continue;
      entering.current.delete(key);
      if (forming.has(key)) {
        if (still) row.animate([{ opacity: 0 }, { opacity: 1 }], ENTER);
        continue;
      }
      if (!still) row.animate([{ opacity: 0 }, { opacity: 1 }], ENTER);
      row
        .querySelector("[data-cells-open]")
        ?.animate(
          [
            { "--cells-bloom": 0 },
            { "--cells-bloom": 1, offset: LIST_MOTION.bloom.rise / BLOOM },
            { "--cells-bloom": 0 },
          ],
          { duration: BLOOM, delay: still ? 0 : ENTER.duration, easing: "ease-in-out" },
        );
    }
  }, [order, view, shown, forming]);

  return list;
}
