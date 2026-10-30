// Where a Cell's own record puts it, for the line while its machine hasn't said: Asleep (settled
// or snoozed), Active (the rest), and within Active, Working (it works, or waits on another chat)
// and Input (an approval, a question or a plan waits). It follows the Cell's face (`cell/mood.ts`),
// so the "?" over a Cell and Needs you never disagree.

import { faceOf } from "../cell/mood";
import { asksYou } from "../cell/kit";
import {
  effectiveSnoozed,
  type EnvironmentThreadShell,
  resolveThreadListV2Status,
} from "../upstream/threads";

type HomeTab = "asleep" | "active" | "working" | "input";

export type TabCounts = Readonly<Record<HomeTab, number>>;

/** What a tab reads of a chat: its face's fields, its snooze and whether it is settled. */
type TabShell = Parameters<typeof faceOf>[0] &
  Parameters<typeof resolveThreadListV2Status>[0] &
  Parameters<typeof effectiveSnoozed>[0] &
  Pick<EnvironmentThreadShell, "settledOverride">;

/** Put away at `now` (an ISO time): settled, or snoozed and not yet woken. */
export function isAway(thread: TabShell, now: string): boolean {
  return thread.settledOverride === "settled" || effectiveSnoozed(thread, { now });
}

/** Whether `thread` is in `tab` at `now` (an ISO time). */
export function inTab(thread: TabShell, tab: HomeTab, now: string): boolean {
  const away = isAway(thread, now);
  if (tab === "asleep" || away) return tab === "asleep" && away;
  if (tab === "active") return true;
  const face = faceOf(thread, resolveThreadListV2Status(thread), {
    now: Date.parse(now),
    driver: null,
  });
  return tab === "input" ? asksYou(face.mood) : face.activity !== undefined;
}
