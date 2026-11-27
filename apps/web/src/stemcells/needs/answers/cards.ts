/**
 * The cards words in Aski's composer may answer, as the reader reads them:
 * the page's cards in place, each with its Cell, its card and whether an
 * answer to it is already on its way.
 */
import { cellNameOf } from "../../cell/name";
import { lastDiskFailure } from "../../disk/pressure";
import { cardOf } from "../card";
import type { Shown } from "../display";
import { answered, type Answer } from "../answering";
import { whoOf } from "../NeedCard";
import type { Addressee } from "./read";

export function addresseesOf(
  shown: ReadonlyArray<Shown>,
  answers: ReadonlyMap<string, Answer>,
  now: number,
): ReadonlyArray<Addressee> {
  return shown.map(({ need, goneAt }) => {
    return {
      number: need.number,
      who: whoOf(need),
      name: need.parentThreadId === null ? cellNameOf(need.threadId) : null,
      kind: need.kind,
      cue: need.prose?.cue ?? null,
      // As its card reads the disk, so "as recommended" never retries a Cell the full disk stopped.
      card: cardOf(need, now, need.kind === "failed" ? lastDiskFailure(need.key) : null),
      gone: goneAt !== null,
      held: answered(answers.get(need.key)),
    };
  });
}
