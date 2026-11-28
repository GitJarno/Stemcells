/**
 * A plan under the message it was made from, in Aski's chat (stemcells/tasks/aski-orchestrator.md,
 * decision 15): once nothing of it waits over the composer, its card stands here for as long as
 * the chat does, each row reading its Cell as Awake does. A Cell that still waits starts or
 * drops from this card, after any reload.
 */
import { use, useEffect, useSyncExternalStore } from "react";

import type { CellRef } from "../../tabs/layout";
import { holdsQueued, keptOf, planUnder, type Said, subscribeKept } from "./kept";
import { refreshKept, seekPlan } from "./keptRead";
import { PlanCard } from "./PlanCard";
import { chatKeyOf, PlanRoom } from "./room";
import { readPlans, subscribePlans } from "./store";

/** How often the server's list is read again while it holds a queued Cell of this chat. */
const QUEUED_READ_MS = 30_000;

export function PlanUnder(props: {
  readonly messageId: string;
  readonly text: string;
  readonly at: number;
}) {
  const aski = use(PlanRoom);
  return aski === null ? null : (
    <Under aski={aski} message={{ id: props.messageId, text: props.text, at: props.at }} />
  );
}

function Under(props: { readonly aski: CellRef; readonly message: Said }) {
  const chat = chatKeyOf(props.aski);
  const { threadId } = props.aski;
  const { id, text, at } = props.message;
  const plans = useSyncExternalStore(subscribePlans, readPlans, readPlans);
  const read = () => keptOf(chat);
  const kept = useSyncExternalStore(subscribeKept, read, read);
  const planId = planUnder(kept, plans, chat, props.message);
  const live = planId === null ? null : (plans.find((plan) => plan.id === planId) ?? null);
  const missing = live === null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the server's list a few more times for a message just sent that shows no plan yet.
  useEffect(() => {
    if (missing) seekPlan(chat, threadId, { id, text, at });
  }, [missing, chat, threadId, id, text, at]);
  // Over the composer until nothing of it waits there: never in both places.
  if (live === null || live.source !== "kept") return null;
  return (
    <div data-aski-plan-under="">
      <PlanCard live={live} />
    </div>
  );
}

/**
 * Reads the server's plans for Aski's chat while its pane stands: once as it mounts, and again
 * every half minute and on the window's focus while a Cell of the chat is queued, since one the
 * server dropped or couldn't start is only learnt from its list.
 */
export function KeptPlans(props: { readonly aski: CellRef }) {
  const chat = chatKeyOf(props.aski);
  const { threadId } = props.aski;
  const queued = () => holdsQueued(readPlans(), chat);
  const waiting = useSyncExternalStore(subscribePlans, queued, queued);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the server's list of this chat's plans when Aski's pane mounts.
  useEffect(() => {
    void refreshKept(chat, threadId);
  }, [chat, threadId]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the server's list again on a timer and on focus while it holds a queued Cell; stop both on unmount.
  useEffect(() => {
    if (!waiting) return;
    const again = () => void refreshKept(chat, threadId);
    const timer = setInterval(again, QUEUED_READ_MS);
    window.addEventListener("focus", again);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", again);
    };
  }, [waiting, chat, threadId]);
  return null;
}
