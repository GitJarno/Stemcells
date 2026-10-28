/**
 * The cards words in Aski's composer may answer, as the reader reads them:
 * the page's cards in place, each with its Cell, its card and whether an
 * answer to it is already on its way.
 */
import { cellNameOf } from "../../cell/name";
import { lastDiskFailure } from "../../disk/pressure";
import { cardOf } from "../card";
import type { Shown } from "../display";
import type { Hold } from "../holds";
import { holds, page } from "../live";
import { whoOf } from "../NeedCard";
import type { Addressee } from "./read";

const HELD = new Set<Hold["state"]>(["holding", "sending", "sent"]);

export function addresseesOf(
  shown: ReadonlyArray<Shown>,
  held: ReadonlyMap<string, Hold>,
  now: number,
): ReadonlyArray<Addressee> {
  return shown.map(({ need, goneAt }) => {
    const hold = held.get(need.key)?.state;
    return {
      number: need.number,
      who: whoOf(need),
      name: need.parentThreadId === null ? cellNameOf(need.threadId) : null,
      kind: need.kind,
      cue: need.prose?.cue ?? null,
      // As its card reads the disk, so "as recommended" never retries a Cell the full disk stopped.
      card: cardOf(need, now, need.kind === "failed" ? lastDiskFailure(need.key) : null),
      gone: goneAt !== null,
      held: hold !== undefined && HELD.has(hold),
    };
  });
}

/**
 * The cards open now, read outside React: the composer's own reader skips
 * what `readAnswers(text, openCards()).spans` takes.
 */
export function openCards(now = Date.now()): ReadonlyArray<Addressee> {
  return addresseesOf(page.read().shown, holds.read(), now);
}
