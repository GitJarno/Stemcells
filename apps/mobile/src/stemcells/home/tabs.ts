// The home's tabs: Asleep (settled or snoozed), Active (the rest), and two views of Active,
// Working (it works, or waits on another chat) and Input (an approval, a question or a plan
// waits on you). A Cell is in a tab when its face says so (`cell/mood.ts`), so the "?" over a
// Cell and the Input tab never disagree.

import { faceOf } from "../cell/mood";
import { asksYou } from "../cell/kit";
import {
  effectiveSnoozed,
  type EnvironmentThreadShell,
  resolveThreadListV2Status,
} from "../upstream/threads";

export type HomeTab = "asleep" | "active" | "working" | "input";

export const HOME_TABS: ReadonlyArray<{ readonly id: HomeTab; readonly label: string }> = [
  { id: "asleep", label: "Asleep" },
  { id: "active", label: "Active" },
  { id: "working", label: "Working" },
  { id: "input", label: "Input" },
];

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

/** How many of `threads` each tab holds at `now`. */
export function countsOf(threads: ReadonlyArray<TabShell>, now: string): TabCounts {
  const counts = { asleep: 0, active: 0, working: 0, input: 0 };
  for (const thread of threads)
    for (const { id } of HOME_TABS) if (inTab(thread, id, now)) counts[id] += 1;
  return counts;
}
