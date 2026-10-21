/**
 * A drag reaches the app wherever its pointer goes. The desktop browser is
 * an Electron `<webview>`: the moment a drag's pointer crosses it, it takes
 * the drag, so the workbench's edge dragged toward the browser stopped
 * there. While a drag is under way, or the pointer is over a separator
 * where one starts, browsers let the pointer through (`dragThrough.css`).
 * Waiting for the drag to start is too late: a move right after the press
 * can reach the browser before the page knows, and the browser keeps it.
 */
import "./dragThrough.css";

/** Pointers an element in the app holds: drags under way. */
const held = new Set<number>();
let onSeparator = false;

function mark(): void {
  document.documentElement.toggleAttribute("data-stemcells-drag", held.size > 0 || onSeparator);
}

function onPointer(event: Event): void {
  const { pointerId, target, type } = event as PointerEvent;
  if (type === "gotpointercapture") held.add(pointerId);
  else if (type === "lostpointercapture") held.delete(pointerId);
  else onSeparator = target instanceof Element && target.closest('[role="separator"]') !== null;
  mark();
}

let listening = false;

/** Lets every drag through the browser from now on; once is enough. */
export function letDragsThrough(): void {
  if (listening || typeof document === "undefined") return;
  listening = true;
  for (const type of ["gotpointercapture", "lostpointercapture", "pointerover"]) {
    document.addEventListener(type, onPointer, true);
  }
}
