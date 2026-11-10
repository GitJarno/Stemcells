/**
 * The page strip's arithmetic, as plain functions. The tabs' pages sit side
 * by side on one strip, a page wide each; a position is how far along the
 * strip the slate looks, in pages: tab `i` is on stage at position `i`.
 */

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

/**
 * How many pages either side of the settled tab stay mounted: two, so the
 * page a second quick swipe reaches (one past where the first is going)
 * was mounted a turn earlier, its chats loaded and laid out, and never
 * mounts as it slides in.
 */
const MOUNTED_NEAR = 2;

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
 * The tabs whose pages are mounted: the active one, two either side of
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
    for (let near = index - MOUNTED_NEAR; near <= index + MOUNTED_NEAR; near++) {
      const id = tabIds[near];
      if (id !== undefined) mounted.add(id);
    }
  }
  return tabIds.filter((id) => mounted.has(id)).toSorted();
}
