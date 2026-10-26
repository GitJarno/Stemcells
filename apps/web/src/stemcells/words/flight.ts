/**
 * Words go where they act: a ghost of a read word lifts off the field, travels to the control
 * it set (the hero's project, a picker), and fades as the control's new value settles in.
 * Nothing flies when something goes away, nor under reduced motion: the control's own change is
 * the news. `stemcells/tasks/prompting.md`, decision 5.
 */

import { reducedMotion, timed } from "../tokens/motion";

/**
 * Flies `text` from `from` (the word on screen) to `to` (the control it
 * set). It resolves as the word lands, or null when nothing flies.
 */
export function fly(
  text: string,
  from: DOMRect,
  to: Element,
  font: CSSStyleDeclaration,
): Promise<void> | null {
  if (reducedMotion() || from.width === 0) return null;
  const target = to.getBoundingClientRect();
  if (target.width === 0) return null;
  const ghost = document.createElement("span");
  ghost.className = "sc-word sc-word-flight";
  ghost.setAttribute("aria-hidden", "true");
  ghost.textContent = text;
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    font: font.font,
    letterSpacing: font.letterSpacing,
  });
  document.body.append(ghost);
  const dx = target.left + target.width / 2 - (from.left + from.width / 2);
  const dy = target.top + target.height / 2 - (from.top + from.height / 2);
  // The arc lifts first, then comes down on the control.
  const lift = Math.min(48, Math.abs(dy) / 2 + 16);
  const travel = timed("travel");
  const leave = timed("leave");
  const move = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx / 2}px, ${Math.min(0, dy) / 2 - lift}px) scale(0.96)`,
        opacity: 1,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.9)`, opacity: 0.9 },
    ],
    { duration: travel.duration, easing: travel.easing, fill: "forwards" },
  );
  return move.finished.then(
    () => {
      void ghost
        .animate([{ opacity: 0.9 }, { opacity: 0 }], {
          duration: leave.duration,
          easing: leave.easing,
          fill: "forwards",
        })
        .finished.finally(() => ghost.remove());
    },
    () => ghost.remove(),
  );
}
