/**
 * Work that holds the page's main thread in one go (a page of chats mounting) waits for a moment
 * nobody will feel it: the page idle, and the person's hands off it for a beat.
 */

/** How long (ms) since the last key, press or scroll counts as hands off. */
const STILL = 600;
/** How long (ms) an idle moment is waited for before the work goes ahead anyway. */
const IDLE_WITHIN = 1500;

let lastInput = 0;
let hearing = false;

function hearInput(): void {
  if (hearing || typeof window === "undefined") return;
  hearing = true;
  const heard = () => {
    lastInput = performance.now();
  };
  for (const type of ["keydown", "pointerdown", "wheel"]) {
    window.addEventListener(type, heard, { capture: true, passive: true });
  }
}

/** Runs `task` once the page is idle and the hands have been still; returns its cancel. */
export function whenStill(task: () => void): () => void {
  hearInput();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let idle: number | undefined;
  const check = () => {
    const wait = STILL - (performance.now() - lastInput);
    if (wait > 0) {
      timer = setTimeout(ask, wait);
      return;
    }
    task();
  };
  // Safari has no idle callbacks: there, a beat of still hands is the whole test.
  const ask = () => {
    if (typeof requestIdleCallback === "function") {
      idle = requestIdleCallback(check, { timeout: IDLE_WITHIN });
    } else {
      timer = setTimeout(check, 0);
    }
  };
  ask();
  return () => {
    clearTimeout(timer);
    if (idle !== undefined) cancelIdleCallback(idle);
  };
}
