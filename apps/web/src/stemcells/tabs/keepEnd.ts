/**
 * A chat read to its end stays at its end while its pane changes width or
 * its transcript changes height. Narrowing reflows the transcript taller,
 * often by more than a screen in one layout, and upstream's list holds its
 * end only through growth within a screen, so the reader was left mid-chat.
 * The pane remembers whether its transcript was at its end at its last
 * width; when the width changes, it holds the end until the transcript
 * settles, or the reader takes over.
 *
 * A terminal drawer opening under the transcript shortens it, and upstream's
 * list keeps its end a frame late (gliding, while a Cell works), so the
 * composer rose with the drawer before the words did. Where upstream's list
 * will keep the end, the transcript's own resize keeps it before the frame
 * is drawn, so the words move with the composer. Our timeline marks when
 * the list follows its end (not while it holds a sent message at the top,
 * nor once the reader scrolled away); the pane does no more than the list
 * would.
 */
const TRANSCRIPT = ".messages-timeline-scroll";
const FOLLOWS = "[data-stemcells-follows]";
/** What stops upstream's list from following its end: its find bar, an app shown full. */
const HOLDS_PLACE = "[data-thread-find-bar], [data-mcp-app-fullscreen]";

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

export function keepEnd(pane: HTMLElement): () => void {
  let width = pane.clientWidth;
  // Unknown until the transcript first scrolls (upstream opens it at its end).
  let atEnd: boolean | null = null;
  let holdUntil = 0;
  let frame = 0;

  const transcript = () => pane.querySelector<HTMLElement>(TRANSCRIPT);
  // The transcript last scrolled, the one whose end is kept through its
  // height, and its height when last seen.
  let scrolled: HTMLElement | null = null;
  let height = 0;
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

  // Where the transcript stands at the width and height it was last seen at.
  // A scroll the reflow itself causes, or one dispatched after the reflow
  // but before the change is seen, doesn't count.
  const onScroll = (event: Event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches(TRANSCRIPT)) return;
    adopt(event.target);
    if (holdUntil > 0 || pane.clientWidth !== width || event.target.clientHeight !== height) return;
    atEnd = isAtEnd(event.target);
  };
  // The transcript whose height is watched: the one last scrolled, or the
  // one there when the reader clicks or types (opening the drawer, say),
  // since a chat opened at its end may not have scrolled yet.
  const adopt = (scroller: HTMLElement | null) => {
    if (scroller === null || scroller === scrolled) return;
    if (scrolled !== null) heightChanged.unobserve(scrolled);
    scrolled = scroller;
    height = scroller.clientHeight;
    heightChanged.observe(scroller);
  };
  // oxlint-disable-next-line t3code/no-raw-resize-observer -- Its callback runs after layout and before paint, the one moment the end can move in the same frame as the composer.
  const heightChanged = new ResizeObserver(() => {
    if (scrolled === null) return;
    const before = height;
    height = scrolled.clientHeight;
    if (height === before || holdUntil > 0) return;
    if (scrolled.querySelector(FOLLOWS) === null || pane.querySelector(HOLDS_PLACE) !== null) {
      return;
    }
    // Where it stood before the change, nothing else having moved it: within
    // a screen of its end, upstream's list keeps the end on its next frame
    // (`maintainScrollAtEndThreshold`, upstream/terminal.contract.test.ts).
    const fromEnd = scrolled.scrollHeight - scrolled.scrollTop - scrolled.clientHeight;
    if (fromEnd - (before - height) > before) return;
    scrolled.scrollTop = scrolled.scrollHeight;
  });
  // oxlint-disable-next-line t3code/no-raw-resize-observer -- It compares the pane's width with the last one it saw, which needs the observer's own callback order (before the reflow's scroll events).
  const resized = new ResizeObserver(() => {
    if (pane.clientWidth === width) return;
    width = pane.clientWidth;
    if (atEnd !== true) return;
    holdUntil = performance.now() + SETTLE_MS;
    if (frame === 0) hold();
  });
  const takeOver = () => {
    if (scrolled === null || !scrolled.isConnected) adopt(transcript());
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
    heightChanged.disconnect();
    pane.removeEventListener("scroll", onScroll, { capture: true });
    for (const type of ["wheel", "pointerdown", "keydown", "touchstart"] as const) {
      pane.removeEventListener(type, takeOver, { capture: true });
    }
  };
}
