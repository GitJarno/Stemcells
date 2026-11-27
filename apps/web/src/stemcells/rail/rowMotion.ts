import { useLayoutEffect, useRef } from "react";

import { cssEasing, enteredRows, LIST_MOTION } from "../motion/listMotion";
import { reducedMotion } from "../tokens/motion";

const MOVE = { duration: LIST_MOTION.move.duration, easing: cssEasing(LIST_MOTION.move.easing) };
const ENTER = { duration: LIST_MOTION.enter.duration, easing: cssEasing(LIST_MOTION.enter.easing) };
const BLOOM = LIST_MOTION.bloom.rise + LIST_MOTION.bloom.fall;

/**
 * A stage's rows under the lists' one motion (`motion/listMotion.ts`), as the phone's list moves
 * its own: a row that changed slot glides there from where it stood, and a row new to the stage
 * fades in where it landed the first time the stage is `shown`, then its light blooms once
 * (`--cells-bloom` in cells.css). With less motion only the light blooms.
 */
export function useRowMotion(shown: boolean) {
  const list = useRef<HTMLOListElement>(null);
  const tops = useRef(new Map<string, number>());
  const keys = useRef<ReadonlySet<string> | null>(null);
  const entering = useRef(new Set<string>());

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the rows' places after each commit and animate the ones that moved or entered, before paint.
  useLayoutEffect(() => {
    const element = list.current;
    if (element === null) return;
    const rows = new Map<string, HTMLElement>();
    for (const row of element.querySelectorAll<HTMLElement>(":scope > [data-cells-thread]"))
      rows.set(row.dataset.cellsThread!, row);
    const before = keys.current;
    for (const key of enteredRows(before, [...rows.keys()])) entering.current.add(key);
    keys.current = new Set(rows.keys());
    const still = reducedMotion();
    // A leave folds in CSS and the rows under it follow: nothing of ours moves them meanwhile.
    const lost = before !== null && [...before].some((key) => !rows.has(key));
    const folding = element.querySelector(":scope > [data-leaving]") !== null;
    const was = tops.current;
    // Layout's own place, not where a glide under way has it.
    tops.current = new Map([...rows].map(([key, row]) => [key, row.offsetTop]));
    if (!still && !lost && !folding)
      for (const [key, now] of tops.current) {
        const from = was.get(key);
        if (from === undefined || from === now) continue;
        rows.get(key)!.animate([{ translate: `0 ${from - now}px` }, { translate: "0 0" }], MOVE);
      }
    for (const key of entering.current) {
      const row = rows.get(key);
      if (row === undefined) entering.current.delete(key);
      if (row === undefined || !shown) continue;
      entering.current.delete(key);
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
  });

  return list;
}
