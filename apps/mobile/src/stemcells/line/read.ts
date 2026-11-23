// A machine's asks and its Cells' stages, read from its own server (`GET /api/stemcells/needs`),
// as push registers (`push/register.ts`). Stemcells never goes through T3's relay, so a machine
// reached that way, or one without the endpoint, has no line: its Cells stand where their
// records do.

import { askMachine, type MachineConnection } from "../upstream/machines";
import { needsListOf, type NeedsList } from "./kit";

export type Reading =
  /** Its asks and stages, as the server last said. */
  | { readonly state: "read"; readonly list: NeedsList }
  /** Not a Stemcells server, or reached through T3's relay. */
  | { readonly state: "none" }
  /** Out of reach just now; what it said last, if anything, stands. */
  | { readonly state: "unreachable"; readonly list: NeedsList | null };

const PATH = "/api/stemcells/needs";
/** A machine asleep behind its tailnet can hold a request open; the next reason to read tries again. */
const GIVE_UP_MS = 10_000;

/** Reads one machine; `last` is what it said before, kept while it is out of reach. */
export async function readNeeds(
  connection: MachineConnection,
  last: NeedsList | null,
  ask: typeof askMachine = askMachine,
): Promise<Reading> {
  if (connection.reach === "relay") return { state: "none" };
  const away: Reading = { state: "unreachable", list: last };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), GIVE_UP_MS);
  try {
    const answer = await ask(connection.environmentId, PATH, { signal: abort.signal });
    // No route is connected yet, or it is reconnecting.
    if (answer === null) return away;
    // Upstream's server, or a Stemcells one from before the line.
    if (answer.status === 404) return { state: "none" };
    if (!answer.ok) return away;
    const list = needsListOf(await answer.json());
    // A server from before the Cells' stages has no line to stand on.
    return list?.cells === undefined ? { state: "none" } : { state: "read", list };
  } catch {
    return away;
  } finally {
    clearTimeout(timer);
  }
}
