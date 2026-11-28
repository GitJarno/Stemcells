/**
 * Reads the server's plans for one of Aski's chats into `kept.ts`: when its pane asks, and a
 * few times more for a message just sent that shows no plan yet.
 */
import { PLAN_NOTE_MS } from "../../../../../../stemcells/orchestrator/wire.ts";
import { readKeptPlans } from "../../upstream/askiPlans";
import { keptOf, planUnder, type Said, takeKept } from "./kept";
import { planOf, readPlans } from "./store";

const reading = new Map<string, Promise<void>>();

/** Reads the server's list for Aski's chat `threadId` again; one read at a time for a chat. */
export function refreshKept(chat: string, threadId: string): Promise<void> {
  const going = reading.get(chat);
  if (going !== undefined) return going;
  const read = readKeptPlans(threadId)
    .then((list) => {
      if (list !== null) takeKept(chat, list);
    })
    .finally(() => reading.delete(chat));
  reading.set(chat, read);
  return read;
}

const SEEK_TRIES = 3;
const SEEK_MS = 4_000;
const sought = new Set<string>();

/**
 * A message just sent shows no plan yet: one made on another device reaches the server's list a
 * moment later. Reads it a few more times, once per message, and never for an old message.
 */
export function seekPlan(chat: string, threadId: string, message: Said): void {
  if (sought.has(message.id) || Date.now() - message.at > PLAN_NOTE_MS) return;
  sought.add(message.id);
  const again = (left: number) =>
    setTimeout(() => {
      void refreshKept(chat, threadId).then(() => {
        const id = planUnder(keptOf(chat), readPlans(), chat, message);
        if (left > 1 && (id === null || planOf(id) === null)) again(left - 1);
      });
    }, SEEK_MS);
  again(SEEK_TRIES);
}
