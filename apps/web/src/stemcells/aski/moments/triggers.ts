// When each moment is earned, as pure rules over what the page saw, so
// they are tested without a browser. `AskiMoments.tsx` feeds them.

import type { Standing } from "../../rail/projects";

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

/** A run as the triggers read it: how it ended, and its times in Unix milliseconds. */
export interface RunSeen {
  readonly id: string;
  readonly ended: "landed" | "dropped" | "cancelled" | null;
  readonly requestedAt: number | null;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
}

/** A chat as the triggers read it. */
export interface ChatSeen {
  readonly key: string;
  readonly standing: Standing;
  readonly run: RunSeen | null;
  readonly createdAt: number;
  readonly launched: boolean;
}

/** How long away counts as being out, in milliseconds. */
export const OUT_FOR = 60 * 60_000;

/** How many Cells landed while the person was out, from `from` to `to`; none when they weren't gone an hour. */
export function landedWhileOut(
  back: { readonly from: number; readonly to: number } | undefined,
  chats: readonly ChatSeen[],
): number {
  if (back === undefined || back.to - back.from < OUT_FOR) return 0;
  return chats.filter(
    ({ run }) =>
      run?.ended === "landed" &&
      run.endedAt !== null &&
      run.endedAt >= back.from &&
      run.endedAt <= back.to,
  ).length;
}

/** How many Cells one message to Aski must start to be many. */
export const MANY = 5;

/** The Cells Aski's run started: chats launched through the tools while it ran, up to `now`. */
export function startedBy<Chat extends ChatSeen>(
  run: RunSeen | null,
  chats: readonly Chat[],
  now: number,
): Chat[] {
  if (run === null || run.requestedAt === null) return [];
  const from = run.requestedAt,
    to = run.endedAt ?? now;
  return chats.filter((chat) => chat.launched && chat.createdAt >= from && chat.createdAt <= to);
}

/** At least this many asks waiting at once, answered down to none within this long of the most. */
export const CLEAR = { asks: 3, within: 30 * 60_000 } as const;

/** Asks waiting on the person since they last had none: the most at once, and when that was. */
export interface Waiting {
  readonly most: number;
  readonly mostAt: number | null;
}

export const NONE_WAITING: Waiting = { most: 0, mostAt: null };

/** The asks waiting after `count` are seen at `now`, and the most there were when they have just gone to none in time. */
export function waited(
  waiting: Waiting,
  count: number,
  now: number,
): { readonly waiting: Waiting; readonly cleared: number | null } {
  if (count > 0)
    return {
      waiting: count > waiting.most ? { most: count, mostAt: now } : waiting,
      cleared: null,
    };
  const cleared =
    waiting.most >= CLEAR.asks && waiting.mostAt !== null && now - waiting.mostAt <= CLEAR.within
      ? waiting.most
      : null;
  return { waiting: NONE_WAITING, cleared };
}

/** A run of at least this long, in milliseconds, is a haul. */
export const HAUL = 60 * 60_000;

/** A run watched since it was asked for: whether it has asked anything of the person. */
interface Watched {
  readonly run: string;
  readonly whole: boolean;
  readonly asked: boolean;
}

/** The runs being watched, by chat. */
export type Watching = ReadonlyMap<string, Watched>;

/**
 * Each chat's run as the page sees it again at `now`, the page having been
 * open since `openedAt`. A run counts as watched whole when the page was
 * open before it was asked for. Says the hauls just ended: a run of an hour
 * or more, watched whole, that landed without asking the person anything,
 * in whole hours.
 */
export function hauled(
  watching: Watching,
  chats: readonly ChatSeen[],
  openedAt: number,
): {
  readonly watching: Watching;
  readonly hauls: { readonly key: string; readonly hours: number }[];
} {
  const next = new Map<string, Watched>();
  const hauls: { key: string; hours: number }[] = [];
  for (const chat of chats) {
    const run = chat.run;
    if (run === null) continue;
    const before = watching.get(chat.key);
    const seen: Watched =
      before !== undefined && before.run === run.id
        ? { ...before, asked: before.asked || chat.standing === "needsYou" }
        : {
            run: run.id,
            whole: run.ended === null && (run.requestedAt ?? run.startedAt ?? 0) >= openedAt,
            asked: chat.standing === "needsYou",
          };
    if (run.ended === null) {
      next.set(chat.key, seen);
      continue;
    }
    if (before?.run !== run.id || run.ended !== "landed" || !seen.whole || seen.asked) continue;
    const took = (run.endedAt ?? 0) - (run.startedAt ?? run.requestedAt ?? Infinity);
    if (took >= HAUL) hauls.push({ key: chat.key, hours: Math.floor(took / HAUL) });
  }
  return { watching: next, hauls };
}
