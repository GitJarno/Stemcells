/**
 * A chat read to its end stays at its end while its pane changes width.
 * Narrowing reflows the transcript taller, often by more than a screen in
 * one layout, and upstream's list holds its end only through growth within
 * a screen, so the reader was left mid-chat. The pane remembers whether its
 * transcript was at its end at its last width; when the width changes, it
 * holds the end until the transcript settles, or the reader takes over.
 */
const TRANSCRIPT = ".messages-timeline-scroll";

/** How long the end is held after the last width change, while rows remeasure. */
const SETTLE_MS = 600;

/** Whether a scroller shows its end, within a pixel of rounding. */
export function isAtEnd(box: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= 1;
}

export function keepEndAcrossWidth(pane: HTMLElement): () => void {
  let width = pane.clientWidth;
  // Unknown until the transcript first scrolls (upstream opens it at its end).
  let atEnd: boolean | null = null;
  let holdUntil = 0;
  let frame = 0;

  const transcript = () => pane.querySelector<HTMLElement>(TRANSCRIPT);
  const hold = () => {
    frame = 0;
    const scroller = transcript();
    if (scroller && performance.now() <= holdUntil) {
      scroller.scrollTop = scroller.scrollHeight;
      frame = requestAnimationFrame(hold);
      return;
    }
    holdUntil = 0;
    if (scroller) atEnd = isAtEnd(scroller);
  };
  const release = () => {
    holdUntil = 0;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  // Where the transcript stands at the width it was last seen at. A scroll
  // the reflow itself causes, before the width change is seen, doesn't count.
  const onScroll = (event: Event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches(TRANSCRIPT)) return;
    if (holdUntil > 0 || pane.clientWidth !== width) return;
    atEnd = isAtEnd(event.target);
  };
  // oxlint-disable-next-line t3code/no-raw-resize-observer -- It compares the pane's width with the last one it saw, which needs the observer's own callback order (before the reflow's scroll events).
  const resized = new ResizeObserver(() => {
    if (pane.clientWidth === width) return;
    width = pane.clientWidth;
    if (atEnd !== true) return;
    holdUntil = performance.now() + SETTLE_MS;
    if (frame === 0) hold();
  });
  const takeOver = () => {
    if (holdUntil === 0) return;
    release();
    const scroller = transcript();
    if (scroller) atEnd = isAtEnd(scroller);
  };

  pane.addEventListener("scroll", onScroll, { capture: true, passive: true });
  for (const type of ["wheel", "pointerdown", "keydown", "touchstart"] as const) {
    pane.addEventListener(type, takeOver, { capture: true, passive: true });
  }
  resized.observe(pane);
  return () => {
    release();
    resized.disconnect();
    pane.removeEventListener("scroll", onScroll, { capture: true });
    for (const type of ["wheel", "pointerdown", "keydown", "touchstart"] as const) {
      pane.removeEventListener(type, takeOver, { capture: true });
    }
  };
}
