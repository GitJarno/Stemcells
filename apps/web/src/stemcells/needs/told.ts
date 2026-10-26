/**
 * What the person did with an ask, told to the asks' ledger on this Mac (the server's `asks/`),
 * which keeps it there and sends it nowhere (stemcells/tasks/aski-asks.md, decisions 11 and 12).
 * Nothing waits on it: a tell that doesn't arrive leaves the measure an ask short, no more.
 */
import { postToPrimary } from "../upstream/limitResume";

export type Did = "answered" | "opened" | "flagged";

/** What a flagged ask showed: it keeps them, as the asks to learn from (decision 13). */
export interface Shown {
  readonly ask: string;
  readonly context: string | null;
}

export function tellAsk(
  key: string,
  did: Did,
  more: { readonly note?: string; readonly shown?: Shown } = {},
): Promise<void> {
  return postToPrimary("/api/stemcells/asks", { key, did, ...more }).then(
    () => undefined,
    () => undefined,
  );
}
