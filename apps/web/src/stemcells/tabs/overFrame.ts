/**
 * Whether the pointer is over a frame. A wheel over a frame is the frame's: the page round it
 * hears no wheel event, and still its scrollers scroll when the frame has nowhere to go.
 */

const FRAME = "iframe, webview, embed, object";

let at: { readonly x: number; readonly y: number } | null = null;
let watching = false;

/** Keeps where the pointer was last seen: from now on, and once is enough. */
export function watchPointer(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const seen = (event: PointerEvent) => {
    at = { x: event.clientX, y: event.clientY };
  };
  // `pointerover` too: it is the last the page hears of a pointer that goes into a frame.
  for (const type of ["pointermove", "pointerover", "pointerdown"] as const) {
    window.addEventListener(type, seen, { capture: true, passive: true });
  }
}

/** Whether the pointer is over a frame inside `within`. */
export function pointerOverFrame(within: HTMLElement): boolean {
  // Hover is as of the pointer's last move, a move inside a frame included.
  if (within.querySelector(`:is(${FRAME}):hover`) !== null) return true;
  // A page that slid under a pointer at rest changes no hover: what is under it now says.
  const under = at === null ? null : document.elementFromPoint(at.x, at.y);
  return under !== null && under.matches(FRAME) && within.contains(under);
}
