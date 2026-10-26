/**
 * The page strip's arithmetic, as plain functions. The tabs' pages sit side
 * by side on one strip, a page wide each; a position is how far along the
 * strip the slate looks, in pages: tab `i` is on stage at position `i`.
 * Swiping moves the strip with the fingers; letting go sends it to a page.
 */

/** Past the first or last page, the strip moves this share of the fingers' move. */
export const RUBBER_BAND = 0.25;

/** A swipe that has moved the fingers further than this (px) turns to the next page; a shorter one springs back. */
export const COMMIT_DISTANCE = 110;

/** One swipe, from the moment it took the strip. */
export interface Drag {
  /** Where the strip was when the fingers took it, rubber band undone. */
  readonly from: number;
  /** The page the strip was on, or on its way to, when they took it. */
  readonly heading: number;
  /** The first and last page this swipe can reach: the pages either side of `heading`. */
  readonly lo: number;
  readonly hi: number;
  /** Where the strip follows the fingers one to one: those pages, and where it was taken. */
  readonly low: number;
  readonly high: number;
  /** The strip's last page. */
  readonly last: number;
  /** A page's width in px. */
  readonly width: number;
  /** How far the fingers have moved (px), in the wheel's sense: positive goes toward later pages. */
  readonly travel: number;
}

/**
 * The pages a swipe can reach: one either side of `heading`, the page the
 * strip is on or on its way to, within the strip's `count` pages. A second
 * quick swipe while the first still settles goes on one more page; one back
 * takes the strip back a page from where it was going, as the tabs count.
 */
export function reach(heading: number, count: number): { lo: number; hi: number } {
  const last = Math.max(0, count - 1);
  return {
    lo: Math.max(0, Math.min(heading - 1, last)),
    hi: Math.min(last, Math.max(heading + 1, 0)),
  };
}

/** Where the strip shows `position`: past `lo` or `hi` it gives only a share of the move. */
export function band(position: number, lo: number, hi: number): number {
  if (position < lo) return lo - (lo - position) * RUBBER_BAND;
  if (position > hi) return hi + (position - hi) * RUBBER_BAND;
  return position;
}

/** The position `band` shows as `shown`. */
export function unband(shown: number, lo: number, hi: number): number {
  if (shown < lo) return lo - (lo - shown) / RUBBER_BAND;
  if (shown > hi) return hi + (shown - hi) / RUBBER_BAND;
  return shown;
}

/**
 * Fingers take the strip where it is on screen, `at`, wherever it was going
 * (`heading`): latest input wins, from where the eye sees it.
 */
export function startDrag(at: number, heading: number, count: number, width: number): Drag {
  const { lo, hi } = reach(heading, count);
  // A strip still on its way, more than a page short of where it goes
  // (the page was too busy to keep up), follows the fingers from there;
  // one in the rubber band past the first or last page stays in it.
  const last = Math.max(0, count - 1);
  const low = Math.min(lo, Math.max(at, 0));
  const high = Math.max(hi, Math.min(at, last));
  return {
    from: unband(at, low, high),
    heading: Math.min(Math.max(heading, lo), hi),
    lo,
    hi,
    low,
    high,
    last,
    width: Math.max(1, width),
    travel: 0,
  };
}

export function dragBy(drag: Drag, dx: number): Drag {
  return { ...drag, travel: drag.travel + dx };
}

/**
 * Where the strip is while the fingers hold it: one to one between `low`
 * and `high`; past the first or last page, in the rubber band; at the page
 * the swipe can reach, stopped, as a swipe turns one page and no further.
 */
export function dragPosition(drag: Drag): number {
  const shown = band(drag.from + drag.travel / drag.width, drag.low, drag.high);
  const floor = drag.low > 0 ? drag.low : -Infinity;
  const ceiling = drag.high < drag.last ? drag.high : Infinity;
  return Math.min(Math.max(shown, floor), ceiling);
}

/**
 * The page the strip goes to when the fingers lift, having moved `travel`
 * (px) by then: by distance alone, past `COMMIT_DISTANCE` the next page that
 * way, else the page it was on or going to.
 */
export function releaseTarget(drag: Drag, travel = drag.travel): number {
  if (Math.abs(travel) <= COMMIT_DISTANCE) return drag.heading;
  return travel > 0 ? drag.hi : drag.lo;
}

/**
 * The speed a spring from `from` to `to` sets off with, as a share of its move per second, when
 * the strip moved at `pagesPerSecond` (positive toward `to`). Capped below the spring's pace
 * (`omega`, rad/s), so a critically damped spring never overshoots. A strip moving away from `to`
 * sets off from rest: carrying on would take it past where the fingers left it, and back.
 */
export function releaseVelocity(
  from: number,
  to: number,
  pagesPerSecond: number,
  omega: number,
): number {
  const move = to - from;
  if (Math.abs(move) < 1e-3) return 0;
  const share = pagesPerSecond / move;
  const cap = omega * 0.9;
  return Math.min(Math.max(share, 0), cap);
}

/** How many tabs, besides those beside the active one, stay mounted after a visit. */
export const KEEP_VISITED = 4;

/** `visited` (most recent first) after a visit to `tabId`, keeping only `tabIds`. */
export function visit(
  visited: readonly string[],
  tabId: string | null,
  tabIds: readonly string[],
): string[] {
  const kept = visited.filter((id) => id !== tabId && tabIds.includes(id));
  return (tabId === null ? kept : [tabId, ...kept]).slice(0, KEEP_VISITED);
}

/**
 * The tabs whose pages are mounted: the active one, those either side of
 * `settled` (the active tab once a turn has settled in), and the last few
 * visited, so a swipe back finds its chats as it left them. In a stable
 * order, so a page joining never moves the others in the document.
 */
export function mountedTabs(
  tabIds: readonly string[],
  active: string | null,
  settled: string | null,
  visited: readonly string[],
): string[] {
  const mounted = new Set<string>(visited.slice(0, KEEP_VISITED));
  if (active !== null) mounted.add(active);
  const index = settled === null ? -1 : tabIds.indexOf(settled);
  if (index >= 0) {
    for (const near of [index - 1, index, index + 1]) {
      const id = tabIds[near];
      if (id !== undefined) mounted.add(id);
    }
  }
  return tabIds.filter((id) => mounted.has(id)).toSorted();
}
