// Aski's chat's feed with its plans' cards (stemcells/tasks/aski-orchestrator.md, decision 15),
// and the reads that keep them true: the chat's plans when it opens, again while a message
// just sent has none yet (another device may be making it), and while a queued Cell waits for
// the server's hand, whose failure is only learnt by asking.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { PLAN_NOTE_MS } from "../../../../../../stemcells/orchestrator/wire.ts";
import { useIsFocused } from "../../upstream/plans";
import type { ThreadFeedEntry } from "../../upstream/recallFeed";
import { kept, trays } from "./run";
import { type Made, plansUnder, planTiedTo, withPlans } from "./under";

/** How long after each read a message still without a plan is asked about again. */
const AGAIN_MS = [2_000, 4_000, 8_000];
/** How often a chat with a queued Cell asks what came of it. */
const QUEUED_EVERY_MS = 30_000;

/** The feed's last message in the person's seat. */
function lastAsked(feed: ReadonlyArray<ThreadFeedEntry>) {
  for (let index = feed.length - 1; index >= 0; index--) {
    const entry = feed[index]!;
    if (entry.type === "message" && entry.message.role === "user") return entry;
  }
  return null;
}

/** The feed of a chat with each plan's card under its message, while `on`: Aski's chat alone. */
export function usePlanFeed(
  feed: ReadonlyArray<ThreadFeedEntry>,
  environmentId: string,
  threadId: string,
  on: boolean,
): ReadonlyArray<ThreadFeedEntry> {
  const plans = useSyncExternalStore(kept.subscribe, () => kept.of(environmentId, threadId));
  const entries = useSyncExternalStore(trays.subscribe, trays.read);
  const focused = useIsFocused();
  const [made] = useState<Made>(() => new Map());

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The chat's plans live on its machine: they are read from there when the chat opens.
  useEffect(() => {
    if (on) void kept.read(environmentId, threadId);
  }, [on, environmentId, threadId]);

  const last = on ? lastAsked(feed) : null;
  const unplanned = last !== null && planTiedTo(plans, last) === null ? last : null;
  const unplannedId = unplanned?.id ?? null;
  const unplannedAt = unplanned?.createdAt ?? null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A message just sent may be a plan another device is making: ask its machine a few times, then no more.
  useEffect(() => {
    if (unplannedId === null || unplannedAt === null) return;
    if (Date.now() - Date.parse(unplannedAt) > PLAN_NOTE_MS) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const again = () => {
      timer = setTimeout(() => {
        void kept.read(environmentId, threadId);
        tries += 1;
        if (tries < AGAIN_MS.length) again();
      }, AGAIN_MS[tries]);
    };
    again();
    return () => clearTimeout(timer);
  }, [unplannedId, unplannedAt, environmentId, threadId]);

  const queued =
    on &&
    focused &&
    [...entries.values()].some(
      (entry) =>
        entry.environmentId === environmentId &&
        entry.chatId === threadId &&
        (entry.tray?.acts.some((one) => one.status === "queued") ?? false),
    );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The server starts a queued Cell, and one it couldn't start is only learnt by asking: ask while one waits and the chat is in front.
  useEffect(() => {
    if (!queued) return;
    const timer = setInterval(() => void kept.read(environmentId, threadId), QUEUED_EVERY_MS);
    return () => clearInterval(timer);
  }, [queued, environmentId, threadId]);

  const shown = on
    ? plansUnder(feed, plans, entries)
        .map((pair) => pair.join(" "))
        .join("\n")
    : "";
  // The same feed and cards give the same array: upstream's feed derives its rows from it.
  return useMemo(
    () =>
      shown === ""
        ? feed
        : withPlans(
            feed,
            new Map(shown.split("\n").map((pair) => pair.split(" ") as [string, string])),
            made,
          ),
    [feed, shown, made],
  );
}
