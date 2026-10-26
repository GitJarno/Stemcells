/**
 * The composer floats over its transcript, so a vertical wheel over it scrolls the transcript,
 * as over the Swift app's floating plate: over the line, or over the plate where nothing under
 * the pointer scrolls that way itself (the field does, while it has more to show). A sideways
 * swipe is the tab pager's and passes untouched.
 */
export function scrollThrough(composer: HTMLElement): () => void {
  const onWheel = (event: WheelEvent) => {
    if (!goesThrough(event)) return;
    if (scrollsItself(event.target, composer, event.deltaY)) return;
    const transcript = scrollerUnder(composer, event.clientX, event.clientY);
    if (transcript === null) return;
    event.preventDefault();
    transcript.scrollBy({
      top: wheelPixels(event.deltaY, event.deltaMode, transcript.clientHeight),
      behavior: "instant",
    });
  };
  composer.addEventListener("wheel", onWheel, { passive: false });
  return () => composer.removeEventListener("wheel", onWheel);
}

/** A wheel that may scroll the transcript: mostly vertical, and not a pinch-zoom. */
export function goesThrough(wheel: { deltaX: number; deltaY: number; ctrlKey: boolean }): boolean {
  return !wheel.ctrlKey && Math.abs(wheel.deltaY) > Math.abs(wheel.deltaX);
}

/** Whether a scroller has room to move by `deltaY`. */
export function hasRoom(
  box: { scrollTop: number; scrollHeight: number; clientHeight: number },
  deltaY: number,
): boolean {
  const room = box.scrollHeight - box.clientHeight;
  if (room <= 1) return false;
  return deltaY < 0 ? box.scrollTop > 0 : box.scrollTop < room - 1;
}

/** The wheel's travel in pixels: lines and pages are a mouse's, pixels a trackpad's. */
export function wheelPixels(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * pageHeight;
  return deltaY;
}

const SCROLLS = /(auto|scroll|overlay)/;

/** Whether something between the pointer and the composer can still scroll by `deltaY`. */
function scrollsItself(target: EventTarget | null, composer: HTMLElement, deltaY: number): boolean {
  for (
    let at = target instanceof Element ? target : null;
    at && at !== composer;
    at = at.parentElement
  ) {
    if (SCROLLS.test(getComputedStyle(at).overflowY) && hasRoom(at, deltaY)) return true;
  }
  return false;
}

/** The scroller under the composer at a point: what the wheel would have reached without it. */
function scrollerUnder(composer: HTMLElement, x: number, y: number): HTMLElement | null {
  const under = document.elementsFromPoint(x, y).find((element) => !composer.contains(element));
  for (let at = under ?? null; at; at = at.parentElement) {
    if (at instanceof HTMLElement && SCROLLS.test(getComputedStyle(at).overflowY)) {
      if (at.scrollHeight - at.clientHeight > 1) return at;
    }
  }
  return null;
}
