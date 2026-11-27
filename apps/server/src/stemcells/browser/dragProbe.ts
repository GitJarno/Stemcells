// A touch viewer turns a finger's drag into scrolling, so a slider on the page never moves.
// The touch probe also asks whether the point takes drags itself, and there the viewer sends a
// mouse drag instead (`stemcells/tasks/browser-column.md`).

/**
 * Whether a viewport point lies on something that takes a drag: a range input, an element the
 * page marks draggable, or one under `touch-action: none`, which a page sets on what it drags itself.
 */
export const DRAGS_AT_POINT_SCRIPT = `(x, y) => {
  let element = document.elementFromPoint(x, y);
  while (element && element.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  for (let node = element; node && node.nodeType === 1; node = node.parentElement || node.getRootNode().host) {
    if (node.tagName === "INPUT" && node.type === "range") return !node.disabled;
    if (node.getAttribute("draggable") === "true") return true;
    if (getComputedStyle(node).touchAction === "none") return true;
    if (node === document.body || node === document.documentElement) break;
  }
  return false;
}`;
