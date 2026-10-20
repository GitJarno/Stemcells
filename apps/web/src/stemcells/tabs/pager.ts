/**
 * The page strip's arithmetic, as plain functions. The tabs' pages sit side
 * by side on one strip, a page wide each; a position is how far along the
 * strip the slate looks, in pages: tab `i` is on stage at position `i`.
 * Swiping moves the strip with the fingers; letting go sends it to a page.
 */

/** Past the first or last page (or the pages beside the one swiped from), the strip moves this share of the fingers' move. */
export const RUBBER_BAND = 0.25;

/** A swipe that has moved the fingers further than this (px) turns to the next page; a shorter one springs back. */
export const COMMIT_DISTANCE = 110;

/** Positions this close to a page are on it. */
const ON_PAGE = 0.01;

/** One swipe, from the moment it took the strip. */
export interface Drag {
  /** Where the strip was when the fingers took it, rubber band undone. */
  readonly from: number;
  /** The page the strip was on, or on its way to, when they took it. */
  readonly heading: number;
  /** The first and last page this swipe can reach: the pages either side of where it began. */
  readonly lo: number;
  readonly hi: number;
  /** A page's width in px. */
  readonly width: number;
  /** How far the fingers have moved (px), in the wheel's sense: positive goes toward later pages. */
  readonly travel: number;
}

/** The pages a swipe from `at` can reach: one either side, within the strip's `count` pages. */
export function reach(at: number, count: number): { lo: number; hi: number } {
  const last = Math.max(0, count - 1);
  const clamped = Math.min(Math.max(at, 0), last);
  const nearest = Math.round(clamped);
  const on = Math.abs(clamped - nearest) < ON_PAGE ? nearest : clamped;
  return { lo: Math.max(0, Math.ceil(on) - 1), hi: Math.min(last, Math.floor(on) + 1) };
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
  const { lo, hi } = reach(at, count);
  return {
    from: unband(at, lo, hi),
    heading: Math.min(Math.max(heading, lo), hi),
    lo,
    hi,
    width: Math.max(1, width),
    travel: 0,
  };
}

export function dragBy(drag: Drag, dx: number): Drag {
  return { ...drag, travel: drag.travel + dx };
}

/** Where the strip is while the fingers hold it. */
export function dragPosition(drag: Drag): number {
  return band(drag.from + drag.travel / drag.width, drag.lo, drag.hi);
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
 * The speed a spring from `from` to `to` sets off with, as a share of its
 * move per second, when the strip was moving at `pagesPerSecond`: positive
 * toward `to`. Capped below the spring's own pace (`omega`, rad/s), so a
 * critically damped spring never overshoots.
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
  return Math.min(Math.max(share, -cap), cap);
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
