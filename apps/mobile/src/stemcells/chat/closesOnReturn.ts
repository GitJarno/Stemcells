// A chat the person settled on another device while the phone was away closes when the app
// comes back (stemcells/tasks/settle-everywhere.md). Only a settle by hand counts: the server
// lists those still standing, so an automatic one, or one undone since, never closes it.

import { handSettledAtFrom, type HandSettle } from "../line/kit";

export function closesOnReturn(input: {
  /** The thread the chat shows. */
  readonly shown: string;
  /** When the app went to the background, in ms. */
  readonly awaySince: number;
  /** Its machine's settles by hand; absent from a server before them. */
  readonly settles: ReadonlyArray<HandSettle> | undefined;
}): boolean {
  const settledAt = handSettledAtFrom(input.settles, input.shown);
  // One from before it left came while the chat was in front, or before it was opened on purpose.
  return settledAt !== null && settledAt > input.awaySince;
}
