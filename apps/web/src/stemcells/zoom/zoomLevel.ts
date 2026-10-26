// The page's zoom, read where it changes. A zoom changes the CSS viewport, so each arrives as
// a resize: the desktop app's own (⌘+, ⌘−, ⌘0, the View menu, a pinch, all through
// `webContents.setZoomLevel`) and a browser's. The level shown is the one the page is at,
// never a guess from the keys pressed.

/** What a resize lets the page read about its zoom. */
export interface ZoomView {
  /** The desktop app's own zoom factor (`webFrame`), when the page runs there. */
  readonly appZoomFactor: number | undefined;
  readonly outerWidth: number;
  readonly innerWidth: number;
  readonly devicePixelRatio: number;
}

/**
 * The page's zoom in percent: the desktop app's own, else a browser's. A browser's pixel ratio
 * is its zoom times the display's scale, a quarter step; window width in screen points over
 * CSS pixels tells which. That holds only while nothing sits beside the page (a docked
 * inspector); when the rest of the ratio is no quarter step, the zoom is unreadable: null.
 */
export function zoomOf(view: ZoomView): number | null {
  if (view.appZoomFactor !== undefined) {
    return view.appZoomFactor > 0 ? Math.round(view.appZoomFactor * 100) : null;
  }
  if (view.outerWidth <= 0 || view.innerWidth <= 0 || view.devicePixelRatio <= 0) return null;
  const displayScale = view.devicePixelRatio / (view.outerWidth / view.innerWidth);
  const step = Math.round(displayScale * 4) / 4;
  return step > 0 && Math.abs(displayScale - step) < 0.01
    ? Math.round((view.devicePixelRatio / step) * 100)
    : null;
}

/**
 * Follows the zoom from the first view: each later one gives the level to
 * show when the zoom changed, else null. A browser's zoom moves its pixel
 * ratio and a window resize doesn't, so a browser is read only then; a
 * move to another display moves the ratio but leaves the level.
 */
export function followZoom(first: ZoomView): (view: ZoomView) => number | null {
  let level = zoomOf(first);
  let ratio = first.devicePixelRatio;
  return (view) => {
    if (view.appZoomFactor === undefined && view.devicePixelRatio === ratio) return null;
    ratio = view.devicePixelRatio;
    const next = zoomOf(view);
    if (next === null || next === level) return null;
    level = next;
    return next;
  };
}
