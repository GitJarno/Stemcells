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
 * How many pages stay mounted at most: the active one, the four beside it and the last few
 * visited are eight, and two more are kept from before.
 */
export const MOUNTED_MOST = 10;

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
 * The pages to keep mounted, most wanted first: the active one, two either side of it (so the
 * page a second quick swipe reaches is there before it slides in), the last few visited (so a
 * swipe back finds its chats as it left them), then those kept before. A page stays until
 * `MOUNTED_MOST` are wanted more, so going back and forth between tabs mounts nothing.
 */
export function keep(
  kept: readonly string[],
  tabIds: readonly string[],
  active: string | null,
  visited: readonly string[],
): string[] {
  const index = active === null ? -1 : tabIds.indexOf(active);
  const near = index < 0 ? [] : [0, -1, 1, -2, 2].map((step) => tabIds[index + step]);
  const wanted = [...near, ...visited.slice(0, KEEP_VISITED), ...kept].filter(
    (id): id is string => id !== undefined && tabIds.includes(id),
  );
  return [...new Set(wanted)].slice(0, MOUNTED_MOST);
}

/**
 * The mounted pages after a still moment (`useMountedPages.ts`): those no longer kept leave, or
 * else the most wanted page not yet mounted comes in. One at a time: each mounts in one go.
 */
export function settle(mounted: readonly string[], kept: readonly string[]): string[] {
  const staying = mounted.filter((id) => kept.includes(id));
  if (staying.length !== mounted.length) return staying;
  const next = kept.find((id) => !mounted.includes(id));
  return next === undefined ? staying : [...staying, next];
}
