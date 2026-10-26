/**
 * What the person did with an ask, told to the asks' ledger on this Mac (the server's `asks/`),
 * which keeps it there and sends it nowhere (stemcells/tasks/aski-asks.md, decisions 11 and 12).
 * Nothing waits on it: a tell that doesn't arrive leaves the measure an ask short, no more.
 */
import { postToPrimary } from "../upstream/limitResume";

export type Did = "answered" | "opened" | "flagged";

export function tellAsk(key: string, did: Did, note?: string): void {
  const body = note === undefined ? { key, did } : { key, did, note };
  void postToPrimary("/api/stemcells/asks", body).catch(() => undefined);
}
