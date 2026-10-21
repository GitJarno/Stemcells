/**
 * When the person last pressed or typed, anywhere in the page. Heard on the
 * window from when this loads, ahead of the listeners the workspace adds
 * later: its own (⌘T, ⌘D) stops a key from going any further, so a listener
 * added after it would never hear that key.
 */
let last = Number.NEGATIVE_INFINITY;

const mark = () => {
  last = performance.now();
};

if (typeof window !== "undefined") {
  window.addEventListener("keydown", mark, true);
  window.addEventListener("pointerdown", mark, true);
}

export function lastActedAt(): number {
  return last;
}
