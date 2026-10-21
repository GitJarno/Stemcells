// When each moment is earned, as pure rules over what the page saw, so
// they are tested without a browser. `AskiMoments.tsx` feeds them.

/** Seven clicks on Aski within three seconds. */
export const CLICKS = { count: 7, within: 3_000 } as const;

/** The clicks still counting at `now`, this one added, and whether they make seven. */
export function clicked(
  before: readonly number[],
  now: number,
): { readonly clicks: number[]; readonly seven: boolean } {
  const clicks = [...before.filter((at) => now - at < CLICKS.within), now];
  return clicks.length >= CLICKS.count ? { clicks: [], seven: true } : { clicks, seven: false };
}

/** How long the server must have been silent for its return to count. */
export const SILENCE = 30_000;

/** Whether the server's return at `now` after a silence from `since` is worth saying: long enough, and no run was lost in it. */
export function backAfter(
  since: number,
  now: number,
  dropped: ReadonlyArray<{ readonly at: number }>,
): boolean {
  return now - since >= SILENCE && !dropped.some(({ at }) => at >= since && at <= now);
}

/** The night's hours, local time: from `from` o'clock until `until` o'clock the next morning. */
export const NIGHT_HOURS = { from: 23, until: 5 } as const;

/** The night `now` falls in, named by the date it began (YYYY-MM-DD, local); null by day. */
export function nightOf(now: Date): string | null {
  const hour = now.getHours();
  if (hour < NIGHT_HOURS.from && hour >= NIGHT_HOURS.until) return null;
  const began = new Date(now);
  if (hour < NIGHT_HOURS.until) began.setDate(began.getDate() - 1);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${began.getFullYear()}-${pad(began.getMonth() + 1)}-${pad(began.getDate())}`;
}
