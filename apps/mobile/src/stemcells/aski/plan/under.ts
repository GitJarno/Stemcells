// Aski's chat's feed with each plan's card under the message it was made from
// (stemcells/tasks/aski-orchestrator.md, decision 15), as one more entry upstream's feed draws:
// a ```plan fence, which draws as the plan (`PlanFence.tsx`). Pure; the entries it makes are
// kept, so a list sees the same row again.

import { showsUnder } from "../../../../../../stemcells/orchestrator/rows.ts";
import {
  type KeptPlan,
  PLAN_FENCE,
  planIdOfFence,
  planOfMessage,
} from "../../../../../../stemcells/orchestrator/wire.ts";
import { RECALL_NOTE } from "../../recall/feed";
import {
  type MessageEntry,
  noteIdOf,
  noteUnder,
  ownWordsOf,
  type ThreadFeedEntry,
} from "../../upstream/recallFeed";
import type { PlanEntry } from "./trays";

const PLAN_NOTE = "plan";

/** Each message's plan by one list of plans: a message is read once however often a feed draws. */
const ties = new WeakMap<ReadonlyArray<KeptPlan>, Map<string, string | null>>();

/** The plan one of the person's own messages was made into; null for none, or another's message. */
export function planTiedTo(plans: ReadonlyArray<KeptPlan>, entry: ThreadFeedEntry): string | null {
  if (entry.type !== "message" || entry.message.role !== "user" || plans.length === 0) return null;
  const known = ties.get(plans) ?? new Map<string, string | null>();
  ties.set(plans, known);
  const tied = known.get(entry.message.id);
  if (tied !== undefined) return tied;
  const text = ownWordsOf(entry);
  const found =
    text === null
      ? null
      : planOfMessage(plans, { id: entry.message.id, text, at: Date.parse(entry.createdAt) });
  // What Aski proposed stands in its own reply. Only an id a fence reads can be drawn.
  const id =
    found === null || found.plan.from === "proposed" || planIdOfFence(found.id) === null
      ? null
      : found.id;
  known.set(entry.message.id, id);
  return id;
}

/**
 * Which plan's card stands under which message, as `messageId planId` pairs. A plan over the
 * composer is the tray's until it leaves, and one with no Cell to show has no card.
 */
export function plansUnder(
  feed: ReadonlyArray<ThreadFeedEntry>,
  plans: ReadonlyArray<KeptPlan>,
  entries: ReadonlyMap<string, PlanEntry>,
): Array<readonly [messageId: string, planId: string]> {
  const shown: Array<readonly [string, string]> = [];
  if (plans.length === 0) return shown;
  for (const entry of feed) {
    const id = planTiedTo(plans, entry);
    const held = id === null ? undefined : entries.get(id);
    if (id === null || held === undefined || held.door !== "fence") continue;
    if (held.tray === null || !showsUnder(held.tray)) continue;
    shown.push([(entry as MessageEntry).message.id, id]);
  }
  return shown;
}

/** The entries made so far, by message and plan. */
export type Made = Map<string, MessageEntry>;

/** `feed` with each card under its message, after the Cells its question found; `feed` itself with none. */
export function withPlans(
  feed: ReadonlyArray<ThreadFeedEntry>,
  /** By message id. */
  shown: ReadonlyMap<string, string>,
  made: Made,
): ReadonlyArray<ThreadFeedEntry> {
  if (shown.size === 0) return feed;
  let next: ThreadFeedEntry[] | null = null;
  let pills = -1;
  for (const [index, entry] of feed.entries()) {
    if (index === pills) continue;
    const plan = entry.type === "message" ? shown.get(entry.message.id) : undefined;
    if (entry.type !== "message" || plan === undefined) {
      next?.push(entry);
      continue;
    }
    next ??= feed.slice(0, index);
    next.push(entry);
    const after = feed[index + 1];
    if (after !== undefined && after.id === noteIdOf(entry, RECALL_NOTE)) {
      next.push(after);
      pills = index + 1;
    }
    const key = `${entry.message.id}\n${plan}`;
    const note =
      made.get(key) ?? noteUnder(entry, PLAN_NOTE, `\`\`\`${PLAN_FENCE}\n${plan}\n\`\`\``);
    made.set(key, note);
    next.push(note);
  }
  return next ?? feed;
}
