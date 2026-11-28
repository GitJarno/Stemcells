/**
 * When each Cell of a plan just sent forms on its card's row (aski-orchestrator.md, decision 18):
 * on the Awake list's own stagger. That list's row forms a beat later (`rail/arrivals.ts`), so
 * the Cell reads as thrown across. Times only: the row plays them (`sentPlay.ts`).
 */
import { ARRIVALS } from "../../../../../../stemcells/aski/arrivals.ts";

/** A row that mounts this long after its Cell formed just stands, ms. */
const PLAYED_MS = 4_000;

const sent = new Map<string, number>();

/** Acts `acts` of `planId` were sent now, in this order. */
export function markSent(planId: string, acts: ReadonlyArray<number>): void {
  const now = performance.now();
  for (const [key, at] of sent) if (now - at > PLAYED_MS) sent.delete(key);
  acts.forEach((i, order) => sent.set(`${planId}/${i}`, now + order * ARRIVALS.stagger));
}

/**
 * When act `i` of `planId` forms, a `performance.now()` time; undefined for one not just sent.
 * Taken once: a row drawn again later just stands.
 */
export function takeSent(planId: string, i: number): number | undefined {
  const key = `${planId}/${i}`;
  const at = sent.get(key);
  sent.delete(key);
  return at === undefined || performance.now() - at > PLAYED_MS ? undefined : at;
}

/**
 * The forming of a card row's creature, apart from the same Cell's forming in the Awake list
 * (`cell/forming.ts` keeps one per key): each plays on its own beat.
 */
export const cardFormKey = (threadId: string): string => `plan:${threadId}`;
