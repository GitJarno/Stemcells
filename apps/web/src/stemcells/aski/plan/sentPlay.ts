/**
 * A plan row's Send, on its DOM (aski-orchestrator.md, decision 18): the row makes room and its
 * creature forms there through the Awake rows' glyphs (`rail/Planned.tsx`). One shot, `translate`
 * and `opacity` only, on the lists' timing; with less motion the creature fades in.
 */
import { formAt } from "../../cell/forming";
import { cssEasing, LIST_MOTION } from "../../motion/listMotion";
import { reducedMotion, timing } from "../../tokens/motion";
import { GLYPHS } from "../../words/spawn/plan";
import { glyphsIn } from "../../words/spawn/play";
import { cardFormKey } from "./sent";

const MOVE = { duration: LIST_MOTION.move.duration, easing: cssEasing(LIST_MOTION.move.easing) };
const ENTER = { duration: LIST_MOTION.enter.duration, easing: cssEasing(LIST_MOTION.enter.easing) };

/**
 * `box` is the creature's box, new at the start of `line`; `at` is when its first glyph shows,
 * a `performance.now()` time. Until then the row's words hold where they stood before the box
 * took its room; then they glide to their place as the creature condenses.
 */
export function playSent(line: HTMLElement, box: HTMLElement, threadId: string, at: number): void {
  if (reducedMotion()) {
    box.animate([{ opacity: 0 }, { opacity: 1 }], ENTER);
    return;
  }
  const delay = Math.max(0, at - performance.now());
  const room = box.offsetWidth + (Number.parseFloat(getComputedStyle(line).columnGap) || 0);
  // The project and the title are what the box pushed along: the row's end stands where it stood.
  for (let part = box.nextElementSibling; part !== null; part = part.nextElementSibling) {
    if (room > 0)
      part.animate([{ translate: `${-room}px 0` }, { translate: "0 0" }], {
        ...MOVE,
        delay,
        fill: "backwards",
      });
    if (part.matches("[data-cells-row-title]")) break;
  }
  void glyphsIn(box, at);
  formAt(cardFormKey(threadId), at + GLYPHS.length * timing("formStep"));
}
